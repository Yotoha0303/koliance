package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/koliance/backend/internal/model"
)

// enableCORS sets standard CORS headers for Next.js frontend
func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("/api/v1/health", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "healthy",
			"network":   "Monad Testnet (10143)",
			"timestamp": time.Now().UTC(),
		})
	}))

	// Stats endpoint
	mux.HandleFunc("/api/v1/stats", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		stats := model.NetworkStats{
			ChainID:         10143,
			NetworkName:     "Monad Testnet",
			TotalIdentities: 128,
			TotalTrusts:     542,
			LiveTPS:         9840,
			Status:          "optimal",
		}
		json.NewEncoder(w).Encode(stats)
	}))

	// Identity query mock / stub ready for go-ethereum RPC
	mux.HandleFunc("/api/v1/identities/", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		address := strings.TrimPrefix(r.URL.Path, "/api/v1/identities/")
		w.Header().Set("Content-Type", "application/json")

		if address == "" {
			http.Error(w, `{"error":"address required"}`, http.StatusBadRequest)
			return
		}

		resp := model.Identity{
			Address:      address,
			Exists:       true,
			CreatedAt:    time.Now().Add(-48 * time.Hour),
			MetadataHash: "ipfs://bafkreibm6...",
		}
		json.NewEncoder(w).Encode(resp)
	}))

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	fmt.Printf("🚀 Koliance Go Backend Service listening on http://localhost:%s\n", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
