package stripeclient

import (
	"log"

	"github.com/stripe/stripe-go/v78"
	"github.com/stripe/stripe-go/v78/client"
)

type Client struct {
	sc        *client.API
	secretKey string
}

func New(secretKey string) *Client {
	if secretKey == "" {
		log.Println("[Stripe] Warning: STRIPE_SECRET_KEY not set.")
	}
	stripe.Key = secretKey
	sc := client.New(secretKey, nil)
	return &Client{
		sc:        sc,
		secretKey: secretKey,
	}
}

// CreateCheckoutSession creates a Checkout Session for one-time payments or subscriptions
func (c *Client) CreateCheckoutSession(successURL, cancelURL string, amountCents int64, currency, description string) (*stripe.CheckoutSession, error) {
	params := &stripe.CheckoutSessionParams{
		SuccessURL: stripe.String(successURL),
		CancelURL:  stripe.String(cancelURL),
		Mode:       stripe.String(string(stripe.CheckoutSessionModePayment)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String(currency),
					UnitAmount: stripe.Int64(amountCents),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name:        stripe.String("Koliance AgentCard Deposit / Service"),
						Description: stripe.String(description),
					},
				},
				Quantity: stripe.Int64(1),
			},
		},
	}

	return c.sc.CheckoutSessions.New(params)
}

// CreateCustomer creates a customer object in Stripe
func (c *Client) CreateCustomer(email, name, walletAddress string) (*stripe.Customer, error) {
	params := &stripe.CustomerParams{
		Email: stripe.String(email),
		Name:  stripe.String(name),
		Metadata: map[string]string{
			"wallet_address": walletAddress,
			"platform":       "koliance",
		},
	}
	return c.sc.Customers.New(params)
}

// CreateInvoice generates a standard invoice for an enterprise or agent user
func (c *Client) CreateInvoice(customerID string) (*stripe.Invoice, error) {
	params := &stripe.InvoiceParams{
		Customer: stripe.String(customerID),
		AutoAdvance: stripe.Bool(true),
		CollectionMethod: stripe.String(string(stripe.InvoiceCollectionMethodSendInvoice)),
		DaysUntilDue: stripe.Int64(30),
	}
	return c.sc.Invoices.New(params)
}
