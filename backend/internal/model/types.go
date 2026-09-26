package model

import "time"

// Identity represents on-chain Koliance Identity metadata
type Identity struct {
	Address      string    `json:"address"`
	Exists       bool      `json:"exists"`
	CreatedAt    time.Time `json:"createdAt"`
	MetadataHash string    `json:"metadataHash"`
}

// TrustRecord represents a cryptographic attestation of trust
type TrustRecord struct {
	ID        uint64    `json:"id,omitempty"`
	From      string    `json:"from"`
	To        string    `json:"to"`
	Action    string    `json:"action"`
	Proof     string    `json:"proof"` // bytes32 hex
	Timestamp time.Time `json:"timestamp"`
}

// NetworkStats holds Monad network & contract index stats
type NetworkStats struct {
	ChainID        int64  `json:"chainId"`
	NetworkName    string `json:"networkName"`
	TotalIdentities int64 `json:"totalIdentities"`
	TotalTrusts    int64  `json:"totalTrusts"`
	LiveTPS        int    `json:"liveTps"`
	Status         string `json:"status"`
}
