# AP-CERT-0: Exact completion-gradient contract

Status: **supported for the declared finite certificate**

## Question

Does the AP48 pressure measure nonlinear progression-completion risk, and can a replacement statistic be certified exactly on finite progression hypergraphs?

## Definitions

For a finite (k)-uniform progression hypergraph with indicator (a_v = 1[v\in A]),

[
H(A)=\sum_P\prod_{v\in P}a_v
]

counts completed progressions. The proposed outside-vertex completion gradient is

[
G_A(x)=(1-a_x)\sum_{P\ni x}\prod_{v\in P\setminus\{x\}}a_v.
]

The global completion pressure is (Gamma(A)=\sum_xG_A(x)).

## Exact findings

The AP48 total pressure satisfies

[
\mathcal P_{48}(A)=\sum_P|A\cap P|=\sum_{a\in A}\deg(a).
]

It is therefore a linear weighted occupancy statistic. It does not, by itself, identify completed progressions, one-hole progressions, or maximal AP-free sets.

The executable certificate verifies:

1. (G_A(x)=H(A\cup\{x\})-H(A)) whenever (x\notin A);
2. (Gamma(A)) equals the exact number of one-hole progressions;
3. an AP-free set is inclusion-maximal under single additions exactly when every outside vertex has (G_A(x)>0);
4. interval, cyclic-group, and finite-field progression hypergraphs must remain distinct domains.

## Exhaustive scope

- all interval subsets through (N=12) for the four identities;
- exact interval extremal enumeration through (N=16);
- constructor checks for ([5]), (mathbb Z_7), and (mathbb F_3^2).

The first same-size legacy-pressure collision occurs in ([5]):

- (A=\{1,2\}): legacy pressure (4), completion pressure (1);
- (B=\{1,4\}): legacy pressure (4), completion pressure (0).

## Evidence boundary

This is a finite exact computational certificate and algebraic identity check. It does not establish a new asymptotic upper bound for (r_3(N)), a density theorem, or a capacity theorem. Any such claim requires a separate proof connecting the local completion gradient to a global extremal bound.

## Reproduction

```bash
npm test
npm run certify:ap-cert-0 -- --timestamp=validation
```
