package position

import (
	"math/big"
	"sync"
	"testing"
)

// The numbers below are the same ones the Solidity suite uses
// (contracts/test/perp/PositionManager.ts), so agreement here means agreement
// with the contract rather than with a second guess at the same arithmetic.
const e18 = 1_000_000_000_000_000_000

var (
	mmrBps = uint64(100) // 1% maintenance margin
	// Entry price 180e18. Built with usd() because 180e18 does not fit in int64.
	entry180 = usd(180)
)

func usd(n int64) *big.Int { return new(big.Int).Mul(big.NewInt(n), big.NewInt(e18)) }

// tenXLong builds a 10x long with 999 USD of collateral at an entry of 180.
// size = 999 * 10 = 9990.
func tenXLong() *Position {
	return &Position{
		ID:            1,
		FeedID:        "NVDA",
		CollateralUSD: usd(999),
		SizeUSD:       usd(9990),
		EntryPrice:    entry180,
		IsLong:        true,
	}
}

func tenXShort() *Position {
	p := tenXLong()
	p.IsLong = false
	return p
}

// ==================== PNL ====================

func TestPnLLongAndShortMirrorEachOther(t *testing.T) {
	long, short := tenXLong(), tenXShort()

	// +10% on a 9990 notional is +999.
	up := usd(198) // 180 -> 198
	if got := long.PnL(up); got.Cmp(usd(999)) != 0 {
		t.Errorf("long PnL at +10%% = %s, want %s", got, usd(999))
	}
	if got := short.PnL(up); got.Cmp(usd(-999)) != 0 {
		t.Errorf("short PnL at +10%% = %s, want %s", got, usd(-999))
	}

	// And the mirror image below entry.
	down := usd(162) // 180 -> 162, -10%
	if got := long.PnL(down); got.Cmp(usd(-999)) != 0 {
		t.Errorf("long PnL at -10%% = %s, want %s", got, usd(-999))
	}
	if got := short.PnL(down); got.Cmp(usd(999)) != 0 {
		t.Errorf("short PnL at -10%% = %s, want %s", got, usd(999))
	}
}

func TestPnLAtEntryPriceIsExactlyZero(t *testing.T) {
	if got := tenXLong().PnL(entry180); got.Sign() != 0 {
		t.Errorf("PnL at entry = %s, want 0", got)
	}
}

// Signed division must truncate toward zero, not floor. Go's big.Int.Quo does
// the former and Div does the latter; picking the wrong one shifts every losing
// position by one wei and breaks the boundary tests below.
func TestPnLTruncatesTowardZero(t *testing.T) {
	// size 1, entry 3, mark 1 -> (1 * (1-3)) / 3 = -2/3, which must be 0.
	p := &Position{
		CollateralUSD: big.NewInt(1000),
		SizeUSD:       big.NewInt(1),
		EntryPrice:    big.NewInt(3),
		IsLong:        true,
	}
	if got := p.PnL(big.NewInt(1)); got.Sign() != 0 {
		t.Errorf("(-2)/3 truncated toward zero = %s, want 0 (Div would give -1)", got)
	}
}

// ==================== EQUITY FLOOR ====================

func TestEquityFloorsAtZeroRatherThanGoingNegative(t *testing.T) {
	long := tenXLong()

	// A 50% crash costs 4995 against 999 of collateral: a loss of 5x the margin.
	// The contract floors this at zero rather than letting it go negative.
	crash := usd(90)
	if pnl := long.PnL(crash); pnl.Sign() >= 0 {
		t.Fatalf("expected a loss, got %s", pnl)
	}
	if got := long.Equity(crash); got.Sign() != 0 {
		t.Errorf("equity past bankruptcy = %s, want 0", got)
	}
}

func TestEquityAddsProfitToCollateral(t *testing.T) {
	// +10% on 9990 is +999, so equity is 999 + 999 = 1998.
	if got := tenXLong().Equity(usd(198)); got.Cmp(usd(1998)) != 0 {
		t.Errorf("equity at +10%% = %s, want %s", got, usd(1998))
	}
}

// ==================== LIQUIDATION THRESHOLD ====================

func TestLiquidatableAtExactlyTheThreshold(t *testing.T) {
	p := tenXLong()
	liq := p.LiquidationPrice(mmrBps)

	if liq.Sign() == 0 {
		t.Fatal("expected a non-zero liquidation price")
	}
	// The verdict is `equity <= mm`, so the threshold itself is liquidatable.
	if !p.IsLiquidatable(liq, mmrBps) {
		t.Errorf("position at its liquidation price %s must be liquidatable", liq)
	}
}

// This is the test that actually pins the mirror down. One wei above the
// threshold the verdict must flip — if it does not, the bot and the contract
// disagree about which positions are liquidatable, and the bot burns gas on
// reverting calls.
func TestNotLiquidatableOneWeiAboveTheThreshold(t *testing.T) {
	p := tenXLong()
	liq := p.LiquidationPrice(mmrBps)

	above := new(big.Int).Add(liq, big.NewInt(1))
	if p.IsLiquidatable(above, mmrBps) {
		t.Errorf("one wei above the liquidation price (%s) must NOT be liquidatable", above)
	}
}

func TestLiquidatableOneWeiBelowTheThreshold(t *testing.T) {
	p := tenXLong()
	liq := p.LiquidationPrice(mmrBps)

	below := new(big.Int).Sub(liq, big.NewInt(1))
	if !p.IsLiquidatable(below, mmrBps) {
		t.Errorf("one wei below the liquidation price (%s) must be liquidatable", below)
	}
}

func TestLiquidationPriceForTenXLongMatchesTheContract(t *testing.T) {
	// The Solidity suite asserts ~163.80 by hand:
	//   180 * (99.9 - 999 + 9990) / 9990
	liq := tenXLong().LiquidationPrice(mmrBps)

	lo, hi := usd(163), usd(164)
	if liq.Cmp(lo) <= 0 || liq.Cmp(hi) >= 0 {
		t.Errorf("10x long liquidation price = %s, want it strictly between 163 and 164 USD", liq)
	}
}

func TestLiquidationPriceForShortSitsAboveEntry(t *testing.T) {
	liq := tenXShort().LiquidationPrice(mmrBps)
	if liq.Cmp(entry180) <= 0 {
		t.Errorf("short liquidation price %s must be above the entry %s", liq, entry180)
	}
}

func TestOneXPositionIsLiquidatableOnlyNearZero(t *testing.T) {
	// At 1x, collateral equals size, so mm = size/100 is covered by collateral
	// alone until the price almost halves. Guards against the numerator going
	// non-positive and the helper silently returning 0.
	p := &Position{
		CollateralUSD: usd(1000),
		SizeUSD:       usd(1000),
		EntryPrice:    usd(100),
		IsLong:        true,
	}
	if p.IsLiquidatable(usd(50), mmrBps) {
		t.Error("1x long should survive a 50% drop")
	}
	if !p.IsLiquidatable(usd(1), mmrBps) {
		t.Error("1x long should be liquidatable near zero")
	}
}

// ==================== TABLE ====================

func TestTableApplyOpenAndClose(t *testing.T) {
	tbl := NewTable()
	p := tenXLong()
	tbl.ApplyOpen(p)

	if tbl.Len() != 1 {
		t.Fatalf("Len = %d, want 1", tbl.Len())
	}
	if got, ok := tbl.Get(p.ID); !ok || got != p {
		t.Fatal("Get did not return the stored position")
	}

	tbl.ApplyClose(p.ID)
	if tbl.Len() != 0 {
		t.Errorf("Len after close = %d, want 0", tbl.Len())
	}
}

// Backfill and the live subscription can both deliver the same close, so a
// duplicate must not corrupt the table.
func TestApplyCloseIsIdempotent(t *testing.T) {
	tbl := NewTable()
	tbl.ApplyOpen(tenXLong())

	tbl.ApplyClose(1)
	tbl.ApplyClose(1)
	tbl.ApplyClose(999) // never seen

	if tbl.Len() != 0 {
		t.Errorf("Len = %d, want 0", tbl.Len())
	}
}

func TestSnapshotIsOrderedByID(t *testing.T) {
	tbl := NewTable()
	for _, id := range []uint64{3, 1, 2} {
		p := tenXLong()
		p.ID = id
		tbl.ApplyOpen(p)
	}

	got := tbl.Snapshot()
	for i, p := range got {
		if p.ID != uint64(i+1) {
			t.Fatalf("snapshot[%d].ID = %d, want %d", i, p.ID, i+1)
		}
	}
}

// The table is read by the price loop while the event subscription writes to
// it, so it must be safe under -race.
func TestTableIsConcurrencySafe(t *testing.T) {
	tbl := NewTable()
	var wg sync.WaitGroup

	for w := 0; w < 8; w++ {
		wg.Add(1)
		go func(w int) {
			defer wg.Done()
			for i := 0; i < 200; i++ {
				id := uint64(i)
				p := tenXLong()
				p.ID = id
				tbl.ApplyOpen(p)
				_ = tbl.Snapshot()
				tbl.ApplyClose(id)
			}
		}(w)
	}
	wg.Wait()
}

// ==================== BATCH SCAN ====================

func TestScanGroupsByFeed(t *testing.T) {
	tbl := NewTable()
	for i, feed := range []string{"NVDA", "BTC", "NVDA"} {
		p := tenXLong()
		p.ID = uint64(i + 1)
		p.FeedID = feed
		tbl.ApplyOpen(p)
	}

	// Both feeds crash hard enough to liquidate everything.
	lookup := func(string) (*big.Int, bool) { return usd(50), true }
	batches, skipped := tbl.Scan(mmrBps, lookup)

	if len(skipped) != 0 {
		t.Fatalf("skipped = %v, want none", skipped)
	}
	if len(batches) != 2 {
		t.Fatalf("got %d batches, want 2 (one per feed)", len(batches))
	}
	// Deterministic order: BTC before NVDA.
	if batches[0].FeedID != "BTC" || batches[1].FeedID != "NVDA" {
		t.Errorf("batch order = %s,%s; want BTC,NVDA", batches[0].FeedID, batches[1].FeedID)
	}
	if len(batches[1].PositionIDs) != 2 {
		t.Errorf("NVDA batch has %d ids, want 2", len(batches[1].PositionIDs))
	}
	// Every position in one call is valued against this single snapshot.
	if batches[1].MarkPrice.Cmp(usd(50)) != 0 {
		t.Errorf("batch mark price = %s, want %s", batches[1].MarkPrice, usd(50))
	}
}

func TestScanLeavesHealthyPositionsAlone(t *testing.T) {
	tbl := NewTable()
	tbl.ApplyOpen(tenXLong())

	// Price barely moved; the 10x long's threshold is ~163.8.
	lookup := func(string) (*big.Int, bool) { return usd(180), true }
	batches, _ := tbl.Scan(mmrBps, lookup)

	if len(batches) != 0 {
		t.Errorf("got %d batches for a healthy position, want 0", len(batches))
	}
}

// A feed with no price must be reported, not treated as "not liquidatable".
// Silently skipping would make a stalled oracle look like a healthy book.
func TestScanReportsPositionsWithNoPrice(t *testing.T) {
	tbl := NewTable()
	a, b := tenXLong(), tenXLong()
	a.ID, a.FeedID = 1, "NVDA"
	b.ID, b.FeedID = 2, "UNKNOWN"
	tbl.ApplyOpen(a)
	tbl.ApplyOpen(b)

	lookup := func(feed string) (*big.Int, bool) {
		if feed == "NVDA" {
			return usd(50), true
		}
		return nil, false
	}
	batches, skipped := tbl.Scan(mmrBps, lookup)

	if len(skipped) != 1 || skipped[0] != 2 {
		t.Errorf("skipped = %v, want [2]", skipped)
	}
	if len(batches) != 1 || batches[0].FeedID != "NVDA" {
		t.Errorf("batches = %+v, want one NVDA batch", batches)
	}
}

// The price lookup must be called once per distinct feed per scan, not once per
// position. At 20 positions across 3 feeds that is 3 oracle reads, not 20.
func TestScanResolvesEachFeedOnce(t *testing.T) {
	tbl := NewTable()
	for i := 0; i < 10; i++ {
		p := tenXLong()
		p.ID = uint64(i + 1)
		p.FeedID = "NVDA"
		tbl.ApplyOpen(p)
	}

	calls := 0
	lookup := func(string) (*big.Int, bool) {
		calls++
		return usd(50), true
	}
	tbl.Scan(mmrBps, lookup)

	if calls != 1 {
		t.Errorf("price lookup called %d times for 10 positions on 1 feed, want 1", calls)
	}
}
