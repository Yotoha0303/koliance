package game

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type SteamClient struct {
	apiKey     string
	httpClient *http.Client
}

func NewSteamClient(apiKey string) *SteamClient {
	return &SteamClient{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 3 * time.Second,
		},
	}
}

type PlayerSummary struct {
	SteamID      string `json:"steamid"`
	PersonaName  string `json:"personaname"`
	ProfileURL   string `json:"profileurl"`
	Avatar       string `json:"avatar"`
	AvatarMedium string `json:"avatarmedium"`
	AvatarFull   string `json:"avatarfull"`
	LastLogOff   int64  `json:"lastlogoff"`
}

type OwnedGame struct {
	AppID                  int    `json:"appid"`
	Name                   string `json:"name"`
	PlaytimeForever        int    `json:"playtime_forever"` // in minutes
	Playtime2Weeks         int    `json:"playtime_2weeks"`
	ImgIconURL             string `json:"img_icon_url"`
	HasCommunityVisibleStats bool   `json:"has_community_visible_stats"`
}

type Achievement struct {
	APIName  string `json:"apiname"`
	Achieved int    `json:"achieved"`
	UnlockTime int64 `json:"unlocktime"`
}

// ResolveVanityURL converts a custom vanity profile name into 64-bit Steam ID
func (c *SteamClient) ResolveVanityURL(vanityName string) (string, error) {
	url := fmt.Sprintf("https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=%s&vanityurl=%s", c.apiKey, vanityName)
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Response struct {
			Success int    `json:"success"`
			SteamID string `json:"steamid"`
			Message string `json:"message"`
		} `json:"response"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", err
	}

	if result.Response.Success != 1 {
		return "", fmt.Errorf("steam vanity resolution failed: %s", result.Response.Message)
	}

	return result.Response.SteamID, nil
}

// GetPlayerSummary fetches profile avatar and persona name
func (c *SteamClient) GetPlayerSummary(steamID string) (*PlayerSummary, error) {
	url := fmt.Sprintf("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=%s&steamids=%s", c.apiKey, steamID)
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Response struct {
			Players []PlayerSummary `json:"players"`
		} `json:"response"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if len(result.Response.Players) == 0 {
		return nil, fmt.Errorf("no steam player found for id: %s", steamID)
	}

	return &result.Response.Players[0], nil
}

// GetOwnedGames returns games, playtime and app titles
func (c *SteamClient) GetOwnedGames(steamID string) ([]OwnedGame, int, error) {
	url := fmt.Sprintf("https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=%s&steamid=%s&include_appinfo=1&include_played_free_games=1", c.apiKey, steamID)
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()

	bodyBytes, _ := io.ReadAll(resp.Body)

	var result struct {
		Response struct {
			GameCount int         `json:"game_count"`
			Games     []OwnedGame `json:"games"`
		} `json:"response"`
	}

	if err := json.Unmarshal(bodyBytes, &result); err != nil {
		return nil, 0, err
	}

	return result.Response.Games, result.Response.GameCount, nil
}

// GetPlayerAchievements retrieves achievements for a specific game
func (c *SteamClient) GetPlayerAchievements(steamID string, appID int) ([]Achievement, string, error) {
	url := fmt.Sprintf("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?key=%s&steamid=%s&appid=%d", c.apiKey, steamID, appID)
	resp, err := c.httpClient.Get(url)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	var result struct {
		PlayerStats struct {
			SteamID      string        `json:"steamID"`
			GameName     string        `json:"gameName"`
			Achievements []Achievement `json:"achievements"`
			Success      bool          `json:"success"`
		} `json:"playerstats"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, "", err
	}

	return result.PlayerStats.Achievements, result.PlayerStats.GameName, nil
}
