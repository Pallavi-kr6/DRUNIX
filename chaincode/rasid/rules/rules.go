// Package rules holds the pure, dependency-free ownership rules of Rasid.
// Everything here is unit-tested without a Fabric network (go test ./rules).
package rules

import "fmt"

const (
	Registered = "REGISTERED"
	Accepted   = "ACCEPTED"
	Discounted = "DISCOUNTED"
	Partial    = "PARTIALLY_TRANSFERRED"
	Settled    = "SETTLED"

	RoleOperator  = "OPERATOR"
	RoleFinancier = "FINANCIER"
	RoleInsurer   = "INSURER"
	RoleAuditor   = "AUDITOR"
)

// Error carries a stable reason code. The API parses the "RASID:<CODE>:" prefix.
type Error struct{ Code, Msg string }

func (e *Error) Error() string { return fmt.Sprintf("RASID:%s: %s", e.Code, e.Msg) }

func Fail(code, f string, a ...any) error { return &Error{code, fmt.Sprintf(f, a...)} }

var transitions = map[string][]string{
	Registered: {Accepted},
	Accepted:   {Discounted},
	Discounted: {Partial, Settled},
	Partial:    {Partial, Settled},
	Settled:    {},
}

func CanTransition(from, to string) bool {
	for _, t := range transitions[from] {
		if t == to {
			return true
		}
	}
	return false
}

// CanMove: positions may be transferred or released only in these states.
func CanMove(status string) bool { return status == Discounted || status == Partial }

func RequireRole(role string, allowed ...string) error {
	for _, a := range allowed {
		if role == a {
			return nil
		}
	}
	return Fail("ROLE_NOT_AUTHORISED", "role %s may not perform this action", role)
}

func CheckAmount(a int64) error {
	if a <= 0 {
		return Fail("INVALID_AMOUNT", "amount must be a positive integer number of paise")
	}
	return nil
}

// Transfer debits the seller and credits the buyer atomically. Total is conserved.
func Transfer(fromAmt, toAmt, amt, outstanding int64) (int64, int64, error) {
	if err := CheckAmount(amt); err != nil {
		return 0, 0, err
	}
	if fromAmt <= 0 {
		return 0, 0, Fail("NOT_A_HOLDER", "caller holds no position in this factoring unit")
	}
	if amt > fromAmt {
		return 0, 0, Fail("INSUFFICIENT_POSITION", "requested %d paise but holder has %d", amt, fromAmt)
	}
	if toAmt+amt > outstanding {
		return 0, 0, Fail("OVER_ALLOCATION", "position would exceed outstanding amount")
	}
	return fromAmt - amt, toAmt + amt, nil
}

func Release(holderAmt, amt int64) (int64, error) {
	if err := CheckAmount(amt); err != nil {
		return 0, err
	}
	if holderAmt <= 0 {
		return 0, Fail("NOT_A_HOLDER", "caller holds no position in this factoring unit")
	}
	if amt > holderAmt {
		return 0, Fail("INSUFFICIENT_POSITION", "requested %d paise but holder has %d", amt, holderAmt)
	}
	return holderAmt - amt, nil
}
