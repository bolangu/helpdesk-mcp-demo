// issue_refund enforces these values and the policy text is generated from them,
// so what Claude reads can't drift from what the server does.
export const REFUND_WINDOW_DAYS = 30;
export const SUPERVISOR_LIMIT_CENTS = 25_000;

export const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export const REFUND_POLICY = `# Larkspur Goods refund policy

Larkspur Goods is a fictional store used for this demo.

## Eligibility

- An order must be **delivered** before it can be refunded. Orders that are processing, in transit, or cancelled cannot be refunded.
- Refunds must be issued within **${REFUND_WINDOW_DAYS} days of delivery**.
- Items marked **final sale** cannot be refunded, even if the rest of the order can.

## Amounts

- Total refunds on an order cannot exceed the value of its refundable items, including refunds already issued.
- Shipping charges are not refunded.

## Approvals

- Support agents may refund up to **${usd(SUPERVISOR_LIMIT_CENTS)} in total per order**.
- Anything above that requires a supervisor. Do not split it into smaller refunds. Open an **urgent** ticket with the amount requested and the reason.

## Late or missing deliveries

- If tracking has not updated for 5 or more days, open a **high** priority ticket so the carrier can be contacted.
- Do not promise a delivery date.

## Tone

- Acknowledge the customer's problem before explaining the outcome.
- Never describe a refund as issued unless it has actually been recorded.
`;
