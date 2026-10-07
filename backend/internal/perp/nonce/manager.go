// Package nonce hands out transaction nonces locally.
//
// Why not ask the node
// --------------------
// The obvious implementation is `PendingNonceAt` before each send. It is wrong
// under concurrency, and wrong in a way that is invisible until the demo:
//
//	t1: PendingNonceAt -> 7
//	t2: PendingNonceAt -> 7      (t1 has not broadcast yet, so the node still
//	                              reports 7 as pending)
//	t1: send with nonce 7
//	t2: send with nonce 7        -> one of the two is discarded
//
// Two liquidations are submitted, one lands. The batch looks like it succeeded
// and the position silently stays open. Since the whole point of the bot is to
// clear dozens of positions in one block, this is the failure that matters.
//
// So the counter is local and allocated exactly once per transaction, at send
// time rather than at batch-construction time — a batch that is built and then
// abandoned must not burn a nonce.
//
// Gaps are expected and fine
// --------------------------
// A transaction that fails to broadcast leaves a hole. Nonces are never reused:
// a dropped transaction may still be sitting in a peer's mempool, and reusing
// its nonce would either replace it or be replaced by it. Ethereum is happy to
// mine nonce 9 without 8, so a gap costs nothing but a little patience.
package nonce

import (
	"errors"
	"sync"
)

// ErrExhausted is returned when the counter would overflow uint64.
var ErrExhausted = errors.New("nonce: counter exhausted")

// Manager allocates nonces from a local counter.
//
// Safe for concurrent use. All methods are cheap enough to call per
// transaction; there is no need to batch allocations.
type Manager struct {
	mu sync.Mutex

	// next is the next nonce to hand out.
	next uint64

	// issued is how many nonces have been handed out since the last resync.
	// Purely observational, for logging how far ahead of the chain we are.
	issued uint64
}

// NewManager returns a Manager that will hand out `start` first.
//
// `start` should be the account's confirmed nonce at startup, i.e.
// `NonceAt(addr, nil)` — NOT `PendingNonceAt`. Starting from the pending count
// would skip nonces belonging to transactions already in flight from another
// process sharing the key.
func NewManager(start uint64) *Manager {
	return &Manager{next: start}
}

// Allocate returns the next nonce and advances the counter.
//
// Call this immediately before broadcasting, so a transaction that is never
// sent does not consume a nonce.
func (m *Manager) Allocate() (uint64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.next == ^uint64(0) {
		return 0, ErrExhausted
	}
	n := m.next
	m.next++
	m.issued++
	return n, nil
}

// Resync moves the counter forward to at least `chainNonce`.
//
// It will NOT move it backward. That asymmetry is the whole point: a node that
// reports a lower nonce than we have already issued is either lagging or
// looking at a different mempool view, and honouring it would hand out a nonce
// that is already in flight — exactly the collision this type exists to
// prevent. Going forward is safe (we are behind); going backward is not.
//
// A common trigger is "nonce too low" from the node: some other process sharing
// the key sent a transaction, so the chain is ahead of us and we must catch up.
func (m *Manager) Resync(chainNonce uint64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if chainNonce > m.next {
		m.next = chainNonce
		m.issued = 0
	}
}

// Peek returns the nonce that would be handed out next, without consuming it.
func (m *Manager) Peek() uint64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.next
}

// Issued reports how many nonces have been handed out since the last forward
// resync. A large number means we are far ahead of the chain, which is worth
// logging: it usually means transactions are not landing.
func (m *Manager) Issued() uint64 {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.issued
}
