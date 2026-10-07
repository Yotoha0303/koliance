package nonce

import (
	"sync"
	"testing"
)

func TestAllocateIsSequential(t *testing.T) {
	m := NewManager(7)
	for want := uint64(7); want < 12; want++ {
		got, err := m.Allocate()
		if err != nil {
			t.Fatalf("Allocate: %v", err)
		}
		if got != want {
			t.Fatalf("Allocate = %d, want %d", got, want)
		}
	}
}

func TestPeekDoesNotConsume(t *testing.T) {
	m := NewManager(3)

	if got := m.Peek(); got != 3 {
		t.Fatalf("Peek = %d, want 3", got)
	}
	if got := m.Peek(); got != 3 {
		t.Fatalf("second Peek = %d, want 3 — Peek consumed a nonce", got)
	}
	if got, _ := m.Allocate(); got != 3 {
		t.Fatalf("Allocate after Peek = %d, want 3", got)
	}
}

// The failure this type exists to prevent: N goroutines allocating concurrently
// must get N distinct nonces. With PendingNonceAt-per-send this is exactly the
// test that fails.
func TestConcurrentAllocateNeverDuplicates(t *testing.T) {
	const goroutines = 32
	const each = 250

	m := NewManager(0)
	var wg sync.WaitGroup
	results := make([][]uint64, goroutines)

	for g := 0; g < goroutines; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			out := make([]uint64, 0, each)
			for i := 0; i < each; i++ {
				n, err := m.Allocate()
				if err != nil {
					t.Errorf("Allocate: %v", err)
					return
				}
				out = append(out, n)
			}
			results[g] = out
		}(g)
	}
	wg.Wait()

	seen := make(map[uint64]bool, goroutines*each)
	for _, out := range results {
		for _, n := range out {
			if seen[n] {
				t.Fatalf("nonce %d was handed out twice", n)
			}
			seen[n] = true
		}
	}

	if len(seen) != goroutines*each {
		t.Fatalf("allocated %d distinct nonces, want %d", len(seen), goroutines*each)
	}
	// And they must form a contiguous block with no gaps, since nothing failed.
	for i := 0; i < goroutines*each; i++ {
		if !seen[uint64(i)] {
			t.Fatalf("nonce %d was never allocated", i)
		}
	}
}

// Resyncing forward is how the bot recovers from "nonce too low" when another
// process shares the key.
func TestResyncMovesForward(t *testing.T) {
	m := NewManager(5)
	if _, err := m.Allocate(); err != nil {
		t.Fatal(err)
	}

	m.Resync(20)

	if got, _ := m.Allocate(); got != 20 {
		t.Fatalf("Allocate after forward resync = %d, want 20", got)
	}
}

// Resyncing backward must be refused. A lagging node reporting a stale count
// would otherwise cause us to re-issue a nonce that is already in flight.
func TestResyncRefusesToMoveBackward(t *testing.T) {
	m := NewManager(100)

	m.Resync(3)

	if got := m.Peek(); got != 100 {
		t.Fatalf("Peek after backward resync = %d, want 100 (unchanged)", got)
	}
}

func TestResyncToCurrentValueIsANoOp(t *testing.T) {
	m := NewManager(42)
	m.Resync(42)
	if got := m.Peek(); got != 42 {
		t.Fatalf("Peek = %d, want 42", got)
	}
}

func TestIssuedCountsAndResetsOnForwardResync(t *testing.T) {
	m := NewManager(0)
	for i := 0; i < 5; i++ {
		if _, err := m.Allocate(); err != nil {
			t.Fatal(err)
		}
	}
	if got := m.Issued(); got != 5 {
		t.Fatalf("Issued = %d, want 5", got)
	}

	m.Resync(50)
	if got := m.Issued(); got != 0 {
		t.Fatalf("Issued after resync = %d, want 0", got)
	}
}

func TestAllocateReportsExhaustion(t *testing.T) {
	m := NewManager(^uint64(0) - 1)

	if _, err := m.Allocate(); err != nil {
		t.Fatalf("first Allocate: %v", err)
	}
	if _, err := m.Allocate(); err != ErrExhausted {
		t.Fatalf("Allocate at the ceiling = %v, want ErrExhausted", err)
	}
}
