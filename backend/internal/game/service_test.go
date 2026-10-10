package game

import (
	"errors"
	"net/http"
	"testing"
)

// offlineService never reaches Steam: every request fails at the transport,
// which drives GetUserGameStats into its fallback branch deterministically.
func offlineService() *Service {
	c := NewSteamClient("")
	c.httpClient = &http.Client{Transport: failTransport{}}
	return NewService(c, nil)
}

type failTransport struct{}

func (failTransport) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("offline")
}

func TestValidateSteamIdentifier(t *testing.T) {
	ok := []string{"76561198000000000", "gaben", "abc", "some_name-1"}
	bad := []string{"", "a", "ab", "ab1!", "123", "7656119800000000", "../etc", "name?x=1", "abc def"}
	for _, id := range ok {
		if err := ValidateSteamIdentifier(id); err != nil {
			t.Errorf("%q rejected: %v", id, err)
		}
	}
	for _, id := range bad {
		if ValidateSteamIdentifier(id) == nil {
			t.Errorf("%q accepted", id)
		}
	}
}

// Regression: GET /game/steam/profile?id=ab panicked with
// "slice bounds out of range [-2:]" in the fallback branch.
func TestGetUserGameStatsShortIDDoesNotPanic(t *testing.T) {
	s := offlineService()
	for _, id := range []string{"ab", "a", "1", "!!"} {
		func() {
			defer func() {
				if r := recover(); r != nil {
					t.Fatalf("panic for %q: %v", id, r)
				}
			}()
			if _, err := s.GetUserGameStats(id); !errors.Is(err, ErrInvalidSteamID) {
				t.Errorf("%q: want ErrInvalidSteamID, got %v", id, err)
			}
		}()
	}
}

// A valid-but-short vanity name that Steam cannot resolve falls back to demo
// data; the fallback must not panic either.
func TestFallbackWithShortVanity(t *testing.T) {
	st, err := offlineService().GetUserGameStats("abc")
	if err != nil || st.PersonaName != "SteamOperative_abc" {
		t.Fatalf("got %+v, %v", st, err)
	}
}

func TestIDSuffix(t *testing.T) {
	for in, want := range map[string]string{"": "", "ab": "ab", "abcd": "abcd", "abcdef": "cdef"} {
		if got := idSuffix(in); got != want {
			t.Errorf("idSuffix(%q)=%q want %q", in, got, want)
		}
	}
}

func TestGenerateGameplayProofValidatesInput(t *testing.T) {
	s := offlineService()
	if _, err := s.GenerateGameplayProof("ab", "0x0000000000000000000000000000000000000001", 730); !errors.Is(err, ErrInvalidSteamID) {
		t.Errorf("bad steam id: %v", err)
	}
	if _, err := s.GenerateGameplayProof("76561198000000000", "nope", 730); !errors.Is(err, ErrInvalidWallet) {
		t.Errorf("bad wallet: %v", err)
	}
}
