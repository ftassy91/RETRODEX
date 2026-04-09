Verify that the implemented lot matches the approved plan.

Mode: CONTROL. Do not introduce new work unless it is a blocker.

## Checks

1. Scope compliance: only planned files touched?
2. Plan compliance: all steps completed?
3. Architecture integrity: canonical paths respected?
4. Operator impact: workflow clarity improved?
5. Product impact: collector experience improved?

## Return format

LOT:                [name]
VERDICT:            [ACCEPT | REVISE]
PLAN COMPLIANCE:    [yes | partial]
SCOPE COMPLIANCE:   [yes | drift detected]
INTEGRITY:          [ok | issue]
OPERATOR IMPACT:    [what improved]
PRODUCT IMPACT:     [what improved]
REMAINING RISKS:    [list]
NEXT STEP:          [what to do]
MODEL FOR NEXT:     [recommendation]
