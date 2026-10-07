// Package position mirrors the on-chain position maths so the liquidator can
// decide what to liquidate without an RPC round-trip per position.
//
// The mirror is the hazard here. If this disagrees with PositionManager by even
// one wei at the threshold, the bot submits liquidations that revert (burning
// gas) or skips positions that are in fact liquidatable. That is the same class
// of bug as the frontend's estimated liquidation price, and it gets the same
// treatment: the same operation order as Solidity, and boundary tests at ±1 wei.
//
// Operation order matters and is load-bearing:
//
//   - PnL is `size * (exit - entry) / entry` — one division, on the delta.
//   - Signed division truncates toward zero. Go's big.Int.Quo does the same,
//     but big.Int.Div does NOT (it rounds toward negative infinity), so Quo is
//     the only correct choice here.
//   - The maintenance margin is `size * mmrBps / 10000`, computed BEFORE the
//     equity comparison, so the division truncation is part of the verdict.
//
// Nothing in this package talks to a chain. That is deliberate: it is the part
// that most needs testing and the part that can be tested without a node.
package position

import (
	"math/big"
	"sort"
	"sync"
)

// BPSDenominator mirrors PerpConstants.BPS_DENOMINATOR.
const BPSDenominator = 10000

// Position mirrors the on-chain Position struct, minus the fields the
// liquidator has no use for. Owner and FeedID are hex strings rather than
// go-ethereum types so this package stays dependency-free and unit-testable.
type Position struct {
	ID            uint64
	Owner         string
	FeedID        string
	CollateralUSD *big.Int // 18 decimals
	SizeUSD       *big.Int // 18 decimals
	PayoutCapUSD  *big.Int // 18 decimals
	EntryPrice    *big.Int // 18 decimals
	IsLong        bool
	OpenedAt      uint64
}

// PnL is the unrealised profit or loss at markPrice, in 18-decimal USD.
//
// Mirrors PositionManager._pnl. Returns a fresh value; the receiver is not
// mutated.
func (p *Position) PnL(markPrice *big.Int) *big.Int {
	if markPrice.Cmp(p.EntryPrice) == 0 {
		return big.NewInt(0)
	}

	delta := new(big.Int).Sub(markPrice, p.EntryPrice)
	if !p.IsLong {
		delta.Neg(delta)
	}

	// Quo truncates toward zero, matching Solidity's signed division. Div would
	// floor and disagree for negative deltas.
	return new(big.Int).Quo(new(big.Int).Mul(p.SizeUSD, delta), p.EntryPrice)
}

// Equity is collateral plus PnL, floored at zero.
//
// Mirrors PositionManager._equityAfter. A position can lose its collateral but
// never more than that, and the floor is what makes a bankrupt position read as
// exactly zero rather than negative.
func (p *Position) Equity(markPrice *big.Int) *big.Int {
	pnl := p.PnL(markPrice)
	if pnl.Sign() >= 0 {
		return new(big.Int).Add(p.CollateralUSD, pnl)
	}

	loss := new(big.Int).Neg(pnl)
	if loss.Cmp(p.CollateralUSD) >= 0 {
		return big.NewInt(0)
	}
	return new(big.Int).Sub(p.CollateralUSD, loss)
}

// IsLiquidatable reports whether the position breaches the maintenance margin.
//
// Mirrors PositionManager._isLiquidatable exactly:
//
//	mm     = size * mmrBps / 10000
//	equity = collateral + pnl, floored at 0
//	verdict = equity <= mm
//
// Note `<=`, not `<`: a position sitting exactly on the threshold IS
// liquidatable, and the boundary tests pin that down.
func (p *Position) IsLiquidatable(markPrice *big.Int, mmrBps uint64) bool {
	mm := new(big.Int).Quo(
		new(big.Int).Mul(p.SizeUSD, new(big.Int).SetUint64(mmrBps)),
		big.NewInt(BPSDenominator),
	)
	return p.Equity(markPrice).Cmp(mm) <= 0
}

// LiquidationPrice is the mark price at which IsLiquidatable flips to true.
//
// Mirrors src/lib/perp.ts liquidationPrice, which mirrors the contract. Solves
// `collateral + pnl == mm` for price:
//
//	long : P = entry * (mm - collateral + size) / size
//	short: P = entry * (collateral + size - mm) / size
//
// Two integer divisions, in that order — mm first, then the final divide. The
// contract does the same two, so the results agree. Returns zero when the
// numerator is non-positive, meaning collateral alone already covers the
// margin (only reachable at 1x).
func (p *Position) LiquidationPrice(mmrBps uint64) *big.Int {
	if p.SizeUSD.Sign() == 0 {
		return big.NewInt(0)
	}

	mm := new(big.Int).Quo(
		new(big.Int).Mul(p.SizeUSD, new(big.Int).SetUint64(mmrBps)),
		big.NewInt(BPSDenominator),
	)

	var numerator *big.Int
	if p.IsLong {
		numerator = new(big.Int).Sub(new(big.Int).Add(mm, p.SizeUSD), p.CollateralUSD)
	} else {
		numerator = new(big.Int).Sub(new(big.Int).Add(p.CollateralUSD, p.SizeUSD), mm)
	}
	if numerator.Sign() <= 0 {
		return big.NewInt(0)
	}

	return new(big.Int).Quo(new(big.Int).Mul(p.EntryPrice, numerator), p.SizeUSD)
}

// Table is a concurrency-safe view of open positions, built from chain events.
type Table struct {
	mu        sync.RWMutex
	positions map[uint64]*Position
}

// NewTable returns an empty table.
func NewTable() *Table {
	return &Table{positions: make(map[uint64]*Position)}
}

// ApplyOpen records a newly opened position.
func (t *Table) ApplyOpen(p *Position) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.positions[p.ID] = p
}

// ApplyClose removes a position that was closed or liquidated.
//
// Idempotent: a close for an id the table never saw is a no-op, because the
// backfill and the live subscription can legitimately race and deliver the same
// close twice.
func (t *Table) ApplyClose(id uint64) {
	t.mu.Lock()
	defer t.mu.Unlock()
	delete(t.positions, id)
}

// Len is the number of open positions.
func (t *Table) Len() int {
	t.mu.RLock()
	defer t.mu.RUnlock()
	return len(t.positions)
}

// Get returns a position by id.
func (t *Table) Get(id uint64) (*Position, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	p, ok := t.positions[id]
	return p, ok
}

// Snapshot returns a copy of the open positions, ordered by id.
func (t *Table) Snapshot() []*Position {
	t.mu.RLock()
	defer t.mu.RUnlock()

	out := make([]*Position, 0, len(t.positions))
	for _, p := range t.positions {
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// PriceLookup resolves a feed id to a mark price. The bool is false when the
// feed has no usable price, and such positions are skipped rather than guessed
// at — a missing price must never be treated as "not liquidatable" silently,
// which is why the caller gets to decide what to do about it.
type PriceLookup func(feedID string) (price *big.Int, ok bool)

// Batch is one liquidate() call's worth of work.
type Batch struct {
	FeedID      string
	PositionIDs []uint64
	MarkPrice   *big.Int
}

// Scan collects liquidatable positions grouped into per-feed batches.
//
// Grouping by feed is not cosmetic: `liquidate(ids, updates)` values every
// position in one call against a SINGLE price snapshot, so positions sharing a
// call must share a feed and a price. Mixing feeds in one call would need the
// contract to hold several snapshots, which it does not do.
//
// Positions whose feed has no price are returned in `skipped` rather than
// dropped, so the caller can log the gap instead of quietly missing a
// liquidation.
func (t *Table) Scan(mmrBps uint64, lookup PriceLookup) (batches []Batch, skipped []uint64) {
	byFeed := make(map[string][]uint64)
	prices := make(map[string]*big.Int)

	for _, p := range t.Snapshot() {
		price, ok := prices[p.FeedID]
		if !ok {
			var found bool
			price, found = lookup(p.FeedID)
			if !found {
				skipped = append(skipped, p.ID)
				continue
			}
			prices[p.FeedID] = price
		}

		if p.IsLiquidatable(price, mmrBps) {
			byFeed[p.FeedID] = append(byFeed[p.FeedID], p.ID)
		}
	}

	// Deterministic order so a run is reproducible and testable.
	feeds := make([]string, 0, len(byFeed))
	for f := range byFeed {
		feeds = append(feeds, f)
	}
	sort.Strings(feeds)

	for _, f := range feeds {
		ids := byFeed[f]
		sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
		batches = append(batches, Batch{FeedID: f, PositionIDs: ids, MarkPrice: prices[f]})
	}

	sort.Slice(skipped, func(i, j int) bool { return skipped[i] < skipped[j] })
	return batches, skipped
}
