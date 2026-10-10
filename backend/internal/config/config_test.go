package config

import (
	"reflect"
	"testing"
)

func TestParseOrigins(t *testing.T) {
	got := ParseOrigins(" https://a.example/ ,*, http://localhost:3000,,")
	want := []string{"https://a.example", "http://localhost:3000"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v want %v", got, want)
	}
}

func TestLoadDefaultsFailClosed(t *testing.T) {
	t.Setenv("KOLIANCE_API_TOKEN", "")
	t.Setenv("DEMO_PUBLIC_TRADING", "")
	t.Setenv("CORS_ALLOWED_ORIGINS", "")
	c := Load()
	if c.APIToken != "" || c.DemoPublicTrading {
		t.Fatalf("defaults not fail-closed: token=%q public=%v", c.APIToken, c.DemoPublicTrading)
	}
	want := []string{"https://koliance.oodai.space", "http://localhost:3000", "http://127.0.0.1:3000"}
	if !reflect.DeepEqual(c.CORSAllowedOrigins, want) {
		t.Fatalf("default origins %v", c.CORSAllowedOrigins)
	}
}
