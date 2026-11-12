package rules

import (
	"errors"
	"testing"
)

func code(err error) string {
	var e *Error
	if errors.As(err, &e) {
		return e.Code
	}
	return ""
}

func TestTransferConservesTotal(t *testing.T) {
	f, to, err := Transfer(48000000, 0, 28800000, 48000000)
	if err != nil || f != 19200000 || to != 28800000 || f+to != 48000000 {
		t.Fatalf("got %d %d %v", f, to, err)
	}
}

func TestTransferRejections(t *testing.T) {
	cases := []struct {
		name             string
		from, to, a, out int64
		want             string
	}{
		{"over balance", 100, 0, 101, 1000, "INSUFFICIENT_POSITION"},
		{"zero", 100, 0, 0, 1000, "INVALID_AMOUNT"},
		{"negative", 100, 0, -5, 1000, "INVALID_AMOUNT"},
		{"non holder", 0, 0, 10, 1000, "NOT_A_HOLDER"},
		{"over allocation", 100, 950, 100, 1000, "OVER_ALLOCATION"},
	}
	for _, c := range cases {
		_, _, err := Transfer(c.from, c.to, c.a, c.out)
		if code(err) != c.want {
			t.Errorf("%s: want %s got %v", c.name, c.want, err)
		}
	}
}

func TestLifecycle(t *testing.T) {
	ok := [][2]string{{Registered, Accepted}, {Accepted, Discounted}, {Discounted, Partial}, {Partial, Partial}, {Partial, Settled}, {Discounted, Settled}}
	for _, p := range ok {
		if !CanTransition(p[0], p[1]) {
			t.Errorf("%v should be valid", p)
		}
	}
	bad := [][2]string{{Registered, Discounted}, {Accepted, Accepted}, {Settled, Settled}, {Settled, Partial}, {Registered, Settled}}
	for _, p := range bad {
		if CanTransition(p[0], p[1]) {
			t.Errorf("%v should be invalid", p)
		}
	}
	if CanMove(Settled) || CanMove(Accepted) || !CanMove(Partial) {
		t.Error("CanMove wrong")
	}
}

func TestRolesAndRelease(t *testing.T) {
	if code(RequireRole(RoleInsurer, RoleFinancier)) != "ROLE_NOT_AUTHORISED" {
		t.Error("insurer must not pass")
	}
	if RequireRole(RoleFinancier, RoleFinancier) != nil {
		t.Error("financier must pass")
	}
	if r, err := Release(100, 40); err != nil || r != 60 {
		t.Error("release")
	}
	if _, err := Release(100, 101); code(err) != "INSUFFICIENT_POSITION" {
		t.Error("release over")
	}
}
