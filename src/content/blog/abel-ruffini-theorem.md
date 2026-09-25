---
title: An Intuitive Guide to the Abel–Ruffini Theorem
description: 'Why no formula in radicals solves every quintic: the symmetries of the roots, read through Galois theory, decide what algebra can undo.'
pubDate: 2026-09-25
lang: en
translationKey: abel-ruffini
tags: [mathematics, algebra, galois-theory]
---

Every student meets the quadratic formula,

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a},
$$

and it is natural to assume that a thicker book contains the same kind of formula for every degree. It does for degrees three and four. For degree five it does not, and no future book will: there is no formula that produces the roots of every quintic from its coefficients using only addition, subtraction, multiplication, division and $n$-th roots. This is the Abel–Ruffini theorem.

Put that way, it sounds like a verdict on human ingenuity, but it is really a statement about symmetry. This guide follows that thread: why the classical formulas work, what changes at degree five, and why the obstruction has nothing to do with the roots being hard to find.

## A short history of a missing formula

Babylonian scribes were solving quadratic problems nearly four thousand years ago, and al-Khwarizmi gave completing the square its systematic form in the ninth century. The next step took much longer: in sixteenth-century Italy, Scipione del Ferro and then Niccolò Tartaglia learned to solve cubics, and Gerolamo Cardano published the method in his <cite lang="la">Ars Magna</cite> (1545), together with the solution of the quartic found by his student Lodovico Ferrari.

Two and a half centuries of failed attempts at the quintic followed. In 1770–71 Joseph-Louis Lagrange changed the question: he asked *why* the old methods work, and found that all of them manipulate permutations of the roots. Building on this, Paolo Ruffini argued in 1799 that the general quintic cannot be solved by radicals; his proof was essentially right, but it took for granted that every radical in a solution is a rational function of the roots. Niels Henrik Abel closed the gap in 1824, in a short memoir printed at his own expense. A few years later Évariste Galois, who died in 1832 at twenty, answered the sharper question of *which* equations are solvable by radicals. His work, published only in 1846, became the theory that bears his name.

## Why degrees two, three and four give way

### Quadratics: one square root, one symmetry

Write $x^2 + px + q = (x - r_1)(x - r_2)$. Completing the square,

$$
x^2 + px + q = \Bigl(x + \frac{p}{2}\Bigr)^2 - \frac{p^2 - 4q}{4},
$$

gives the formula, but a second reading is more instructive. The sum $r_1 + r_2 = -p$ and the product $r_1 r_2 = q$ are *symmetric*: swapping the roots leaves them unchanged, and they can be read off the coefficients. The difference $r_1 - r_2$ is not symmetric, since the swap flips its sign, but its square is:

$$
\begin{aligned}
(r_1 - r_2)^2 &= (r_1 + r_2)^2 - 4r_1 r_2 \\
&= p^2 - 4q.
\end{aligned}
$$

One square root recovers $r_1 - r_2$ up to that sign, and then $r_{1,2} = \tfrac12\bigl((r_1 + r_2) \pm (r_1 - r_2)\bigr)$. The square root does exactly one job: it breaks the single symmetry that two roots have.

### Cubics: Cardano's method

Substituting $x = y - \frac{b}{3a}$ and dividing by $a$ removes the quadratic term of $ax^3 + bx^2 + cx + d$, so it suffices to solve a *depressed* cubic $x^3 + px + q = 0$. Cardano looks for a root of the form $x = u + v$. Since $(u + v)^3 = u^3 + v^3 + 3uv(u + v)$, the equation becomes

$$
u^3 + v^3 + q + (3uv + p)(u + v) = 0.
$$

Two unknowns and one equation leave room for a second condition, so impose $3uv = -p$. Then $u^3 + v^3 = -q$ and $u^3 v^3 = -p^3/27$: the numbers $u^3$ and $v^3$ are the roots of the *resolvent quadratic*

$$
t^2 + qt - \frac{p^3}{27} = 0.
$$

Solving it and taking cube roots gives Cardano's formula,

$$
\begin{gathered}
x = \sqrt[3]{-\frac{q}{2} + \sqrt{D}} + \sqrt[3]{-\frac{q}{2} - \sqrt{D}}, \\
D = \frac{q^2}{4} + \frac{p^3}{27},
\end{gathered}
$$

where the two cube roots are chosen so that their product is $-p/3$. First a square root, then a cube root: keep that order in mind.

### Quartics: Ferrari's resolvent cubic

The same kind of shift reduces a quartic to $x^4 + px^2 + qx + r = 0$. Ferrari's idea is to add an auxiliary unknown $y$ so that the left-hand side becomes a perfect square:

$$
\begin{aligned}
(x^2 + y)^2 &= (2y - p)\,x^2 - qx \\
&\quad + (y^2 - r).
\end{aligned}
$$

The right-hand side is a quadratic in $x$, and it is a perfect square exactly when its discriminant vanishes: $q^2 = 4(2y - p)(y^2 - r)$. That is a cubic equation for $y$, the *resolvent cubic*

$$
8y^3 - 4py^2 - 8ry + 4pr - q^2 = 0.
$$

Solve it with Cardano's formula. If $q \ne 0$, every root $y$ satisfies $2y \ne p$ (and if $q = 0$ the quartic is simply a quadratic in $x^2$), so both sides are squares and, with $s = \sqrt{2y - p}$, the quartic splits into two quadratics:

$$
x^2 + y = \pm\Bigl(s\,x - \frac{q}{2s}\Bigr).
$$

### Lagrange's resolvents

Lagrange asked what these auxiliary quantities *are* in terms of the roots. For a cubic with roots $r_1, r_2, r_3$, let $\omega = e^{2\pi i/3}$ and set

$$
\begin{aligned}
L &= r_1 + \omega r_2 + \omega^2 r_3, \\
L' &= r_1 + \omega^2 r_2 + \omega r_3.
\end{aligned}
$$

The cyclic permutation $r_1 \mapsto r_2 \mapsto r_3 \mapsto r_1$ sends $L$ to $\omega^2 L$, so $L^3$ is unchanged by it, while a transposition such as $r_2 \leftrightarrow r_3$ exchanges $L$ and $L'$. Under all six permutations, then, $L^3$ takes only two values, $L^3$ and $(L')^3$, whose sum and product are symmetric and hence known. So $L^3$ solves a quadratic with known coefficients, and this is Cardano's resolvent in disguise: for $x^3 + px + q$ one can take $u = L/3$ and $v = L'/3$.

For the quartic, the three quantities

$$
\begin{gathered}
r_1 r_2 + r_3 r_4, \\
r_1 r_3 + r_2 r_4, \\
r_1 r_4 + r_2 r_3
\end{gathered}
$$

are merely shuffled among themselves by the 24 permutations of the roots, so they are the roots of a cubic with known coefficients; halved, they are exactly the roots of Ferrari's resolvent cubic. The permutations that fix all three form the *Klein four-group* $V_4 = \{e, (1\,2)(3\,4), (1\,3)(2\,4), (1\,4)(2\,3)\}$.

Lagrange's lesson: each classical formula computes a chain of expressions in the roots, each fixed by fewer permutations than the last, and each obtained from the previous ones by solving a simple equation.

## Roots, permutations and fields

### Symmetric expressions come for free

By Vieta's formulas, if $x^n + a_{n-1}x^{n-1} + \dots + a_1 x + a_0 = (x - r_1)\cdots(x - r_n)$, then

$$
\begin{aligned}
a_{n-1} &= -(r_1 + r_2 + \dots + r_n), \\
a_{n-2} &= \textstyle\sum_{i<j} r_i r_j, \quad \dots, \\
a_0 &= (-1)^n\, r_1 r_2 \cdots r_n .
\end{aligned}
$$

Up to sign these are the elementary symmetric polynomials, and by the fundamental theorem on symmetric polynomials every polynomial in the roots that is unchanged by all $n!$ permutations (the whole symmetric group $S_n$) is a polynomial in the coefficients. Symmetric expressions are therefore free; the difficulty lies in expressions with less symmetry, and the extreme case is the list of roots itself, which only the identity permutation leaves unchanged.

### A solution by radicals is a tower of fields

From now on we work over a field $F$ of characteristic 0, such as $\mathbb{Q}$. A formula in radicals is a finite recipe: adjoin a number $\alpha_1$ with $\alpha_1^{m_1} \in F$, then a number $\alpha_2$ with $\alpha_2^{m_2} \in F(\alpha_1)$, and so on. The recipe builds a tower of field extensions

$$
\begin{gathered}
F = F_0 \subset F_1 \subset \dots \subset F_k, \\
F_i = F_{i-1}(\alpha_i), \quad \alpha_i^{m_i} \in F_{i-1},
\end{gathered}
$$

and a polynomial $f \in F[x]$ is *solvable by radicals* if some such tower ends in a field that contains all the roots of $f$.

With enough roots of unity present, each step is simple. Adjoining roots of unity is harmless ($F(\zeta)/F$ has an abelian Galois group), so put a primitive $N$-th root of unity $\zeta$, with $N$ divisible by every $m_i$, at the bottom of the tower. Then an automorphism of $F_i$ fixing $F_{i-1}$ must send $\alpha_i$ to another root of $x^{m_i} - \alpha_i^{m_i}$, that is, to $\eta\,\alpha_i$ for some $m_i$-th root of unity $\eta$, and composing automorphisms multiplies these roots of unity: every radical step is a *cyclic*, in particular abelian, extension.

### The Galois group and the dictionary

Let $K$ be the splitting field of $f$ over $F$, the field generated by all its roots. The *Galois group* $\mathrm{Gal}(f) = \mathrm{Gal}(K/F)$ consists of the automorphisms of $K$ that fix $F$ pointwise. Each one permutes the roots of $f$ and is determined by that permutation, so $\mathrm{Gal}(f)$ is a subgroup of $S_n$: the permutations of the roots that preserve every algebraic relation among them. For the *general* polynomial, whose coefficients are independent variables, there are no special relations, and the Galois group is all of $S_n$.

The fundamental theorem of Galois theory is a dictionary between fields and groups. Intermediate fields $F \subseteq E \subseteq K$ correspond one-to-one to subgroups $H$ of $G = \mathrm{Gal}(K/F)$: a field goes to the automorphisms that fix it pointwise, a subgroup to the elements it fixes. Bigger fields match smaller groups, and $E/F$ is itself a Galois extension exactly when $H$ is a *normal* subgroup of $G$, in which case $\mathrm{Gal}(E/F) \cong G/H$.

Now read a tower of radicals through the dictionary. Climbing from $F$ to $K$ one radical at a time becomes descending from $G$ to the trivial group one normal subgroup at a time, with an abelian quotient at every step. (Strictly speaking, the tower may overshoot $K$; one passes to its Galois closure, which is still built from radicals, and uses the fact that $\mathrm{Gal}(f)$ is a quotient of the larger group.)

## Solvable groups and the theorem

This structure is exactly what group theorists call solvability. A finite group $G$ is *solvable* if it has a subnormal series

$$
G = G_0 \trianglerighteq G_1 \trianglerighteq \dots \trianglerighteq G_k = \{e\}
$$

in which each $G_{i+1}$ is normal in $G_i$ (though not necessarily in $G$) and each factor $G_i/G_{i+1}$ is abelian. The dictionary turns towers of radicals into such series, and, with one more idea, back again.

<div class="my-8 rounded-xl border border-zinc-200 bg-white px-5 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">

**Theorem (Galois).** Let $F$ be a field of characteristic 0, for example $\mathbb{Q}$, and let $f \in F[x]$. Then the equation $f(x) = 0$ is solvable by radicals over $F$ if and only if $\mathrm{Gal}(f)$ is a solvable group.

</div>

The extra idea is Lagrange's. To go backwards, refine the series until every factor is cyclic of prime order $p$ and adjoin the needed roots of unity. If $\sigma$ generates the Galois group of such a step, $\theta$ is an element of the larger field and $\zeta$ is a primitive $p$-th root of unity, the Lagrange resolvent

$$
\ell = \sum_{j=0}^{p-1} \zeta^{-j}\,\sigma^{j}(\theta)
$$

satisfies $\sigma(\ell) = \zeta\ell$, so $\ell^p$ lies in the smaller field; for a suitable choice of $\theta$, $\ell \ne 0$, and then $\ell$ generates the step as a $p$-th root. The $L$ of the cubic is exactly this construction.

For the general polynomial the Galois group is $S_n$, so the general equation of degree $n$ is solvable by radicals exactly when $S_n$ is a solvable group. A question about formulas has become a question about permutations.

### The classical formulas, read as ladders

For $n = 3$ the ladder has two rungs:

$$
\begin{gathered}
S_3 \;\triangleright\; A_3 \;\triangleright\; \{e\}, \\
S_3/A_3 \cong C_2, \qquad A_3 \cong C_3 .
\end{gathered}
$$

Here $A_n$ denotes the alternating group of even permutations and $C_m$ the cyclic group of order $m$. The $C_2$ rung is a square root that tells even permutations from odd ones. In Cardano's formula it is $\sqrt{D}$: indeed $D = -\Delta/108$, where $\Delta = \prod_{i<j}(r_i - r_j)^2 = -4p^3 - 27q^2$ is the discriminant, and $\sqrt{\Delta} = \prod_{i<j}(r_i - r_j)$ changes sign under every transposition. The $C_3$ rung is the cube root.

For $n = 4$ the ladder has four rungs:

$$
S_4 \;\triangleright\; A_4 \;\triangleright\; V_4 \;\triangleright\; C_2 \;\triangleright\; \{e\},
$$

with orders $24, 12, 4, 2, 1$ and factors $C_2, C_3, C_2, C_2$, where $C_2 = \{e, (1\,2)(3\,4)\}$. This $C_2$ is normal in $V_4$ but not in $S_4$, which is allowed: a subnormal series only asks each group to be normal in the one just above it. The ladder is Ferrari's method. The first two rungs solve the resolvent cubic (whose roots are fixed exactly by $V_4$) with a square root and a cube root; the last two are square roots, $s = \sqrt{2y - p}$ to split the quartic into two quadratics and the quadratic formula to finish.

## Five is different: a simple group of order 60

For $n = 5$ the first rung survives. The alternating group $A_5$ has index 2 in $S_5$, so it is normal and $S_5/A_5 \cong C_2$: the square root of the discriminant is available as before. The trouble is the next rung: to continue the ladder, $A_5$ would have to be abelian, which it is not, or contain a normal subgroup $N$ with $\{e\} \ne N \ne A_5$.

A normal subgroup is a union of conjugacy classes, so it helps to know the classes. The 60 elements of $A_5$ fall into five of them:

| Cycle type | Example | Class size |
| --- | --- | ---: |
| identity | $e$ | 1 |
| 3-cycles | $(1\,2\,3)$ | 20 |
| double transpositions | $(1\,2)(3\,4)$ | 15 |
| 5-cycles | $(1\,2\,3\,4\,5)$ | 12 |
| 5-cycles | $(1\,3\,5\,2\,4)$ | 12 |

The 24 five-cycles of $S_5$ split into two classes of 12 in $A_5$: a 5-cycle and its square, like the two in the table, are conjugate only by odd permutations.

Now let $N$ be a normal subgroup of $A_5$. It contains $e$, it is a union of whole classes, and by Lagrange's theorem its order divides 60. So $|N|$ is 1 plus the sum of some of the numbers 12, 12, 15 and 20. The possible values are

$$
\begin{gathered}
1, 13, 16, 21, 25, 28, \\
33, 36, 40, 45, 48, 60,
\end{gathered}
$$

and the only divisors of 60 among them are 1 and 60. So $A_5$ has no normal subgroups other than $\{e\}$ and itself: it is a *simple group*. It is also thoroughly non-abelian, since in an abelian group every conjugacy class has a single element.

Consequently the ladder for $S_5$ cannot be refined beyond

$$
S_5 \;\triangleright\; A_5 \;\triangleright\; \{e\}.
$$

This is the only composition series of $S_5$ (a subnormal series with simple factors), and by the Jordan–Hölder theorem all composition series of a group have the same factors. The composition factors of a solvable group are cyclic of prime order, but one factor here is $A_5$, so $S_5$ is not solvable. In the same way, since $A_n$ is simple and non-abelian for every $n \ge 5$, no $S_n$ with $n \ge 5$ is solvable.

<div class="my-8 rounded-xl border border-zinc-200 bg-white px-5 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">

**Theorem (Abel–Ruffini).** For every $n \ge 5$, the general polynomial equation of degree $n$ is not solvable by radicals.

</div>

<figure class="not-prose my-10">
<div class="relative overflow-hidden rounded-xl border border-zinc-200 bg-white px-3 py-6 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900">
<div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-graph mask-fade-b"></div>
<svg class="relative mx-auto block h-auto w-full max-w-xs text-zinc-900 dark:text-zinc-100" viewBox="48 0 288 316" role="img" aria-label="Two ladders on a common logarithmic scale. Degree 4: S4, A4, V4, C2 and the trivial group, with the abelian factors C2, C3, C2 and C2. Degree 5: S5, A5 and the trivial group, with the factors C2 and A5; the long final rung, A5, is not abelian." xmlns="http://www.w3.org/2000/svg">
<!-- Math labels use KaTeX's fonts, which the formulas on this page already load: they match the text and cost no extra download. -->
<g class="text-zinc-600 dark:text-zinc-400" fill="currentColor" style="font-family: KaTeX_Main, var(--font-serif); font-size: 15px">
<text x="100" y="24" text-anchor="middle"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">n</tspan> = 4</text>
<text x="220" y="24" text-anchor="middle"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">n</tspan> = 5</text>
</g>
<g stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-opacity="0.6">
<line x1="100" y1="143.7" x2="100" y2="164.4"/>
<line x1="100" y1="178.4" x2="100" y2="219.5"/>
<line x1="100" y1="233.5" x2="100" y2="254.3"/>
<line x1="100" y1="268.3" x2="100" y2="289"/>
<line x1="220" y1="63" x2="220" y2="83.8"/>
</g>
<g fill="currentColor">
<circle cx="100" cy="136.7" r="3.5"/>
<circle cx="100" cy="171.4" r="3.5"/>
<circle cx="100" cy="226.5" r="3.5"/>
<circle cx="100" cy="261.3" r="3.5"/>
<circle cx="220" cy="56" r="3.5"/>
</g>
<g fill="none" stroke="currentColor" stroke-width="1.25">
<circle cx="100" cy="296" r="3.5"/>
<circle cx="220" cy="296" r="3.5"/>
</g>
<g fill="currentColor" text-anchor="end" style="font-family: KaTeX_Main, var(--font-serif); font-size: 17px">
<text x="86" y="142.2"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">S</tspan><tspan font-size="12" dy="4">4</tspan></text>
<text x="86" y="176.9"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">A</tspan><tspan font-size="12" dy="4">4</tspan></text>
<text x="86" y="232"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">V</tspan><tspan font-size="12" dy="4">4</tspan></text>
<text x="86" y="266.8"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">2</tspan></text>
<text x="86" y="301.5">{<tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">e</tspan>}</text>
<text x="206" y="61.5"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">S</tspan><tspan font-size="12" dy="4">5</tspan></text>
<text x="206" y="96.3"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">A</tspan><tspan font-size="12" dy="4">5</tspan></text>
<text x="206" y="301.5">{<tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">e</tspan>}</text>
</g>
<g class="text-zinc-600 dark:text-zinc-400" fill="currentColor" style="font-family: KaTeX_Main, var(--font-serif); font-size: 15px">
<text x="114" y="159"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">2</tspan></text>
<text x="114" y="204"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">3</tspan></text>
<text x="114" y="249"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">2</tspan></text>
<text x="114" y="283.6"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">2</tspan></text>
<text x="234" y="78.4"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">C</tspan><tspan font-size="12" dy="4">2</tspan></text>
</g>
<g class="text-accent-700 dark:text-accent-400" fill="currentColor">
<line x1="220" y1="97.8" x2="220" y2="289" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
<circle cx="220" cy="90.8" r="3.5"/>
<text x="234" y="192" style="font-family: KaTeX_Main, var(--font-serif); font-size: 17px"><tspan font-style="italic" style="font-family: KaTeX_Math, var(--font-serif)">A</tspan><tspan font-size="12" dy="4">5</tspan></text>
<text x="234" y="212" style="font-family: var(--font-mono); font-size: 13px">non-abelian</text>
</g>
</svg>
</div>
<figcaption class="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"><span class="label-mono mr-2 text-zinc-500 dark:text-zinc-400">Fig. 1</span>Composition series drawn as ladders. Each rung is labelled with its factor; a group sits at a height proportional to the logarithm of its order, so a rung's length measures the order of its factor. <i>S</i><sub>4</sub> comes apart into four small abelian rungs; <i>S</i><sub>5</sub> has one short rung and then a single long one, the simple group <i>A</i><sub>5</sub>, which cannot be subdivided.</figcaption>
</figure>

## A quintic with no radical solution

The general polynomial is a formal object with variable coefficients, but the theorem has teeth for honest numbers too. Consider

$$
f(x) = x^5 - 4x + 2 .
$$

1. **It is irreducible.** Eisenstein's criterion applies at $p = 2$: 2 divides every coefficient except the leading one, and $2^2 = 4$ does not divide the constant term. So $f$ is irreducible over $\mathbb{Q}$, and its five roots are distinct.
2. **It has exactly three real roots.** Since $f(-2) = -22 < 0 < 2 = f(0)$ and $f(1) = -1 < 0 < 26 = f(2)$, the sign changes on each of $(-2, 0)$, $(0, 1)$ and $(1, 2)$, so there are at least three real roots. The derivative $f'(x) = 5x^4 - 4$ vanishes only at $x = \pm(4/5)^{1/4}$, so by Rolle's theorem there are at most three. The other two roots form a pair of complex conjugates.
3. **The Galois group contains a transposition.** Complex conjugation maps the splitting field $K \subset \mathbb{C}$ to itself and fixes $\mathbb{Q}$, so it belongs to $\mathrm{Gal}(f)$. It fixes the three real roots and swaps the other two.
4. **It contains a 5-cycle.** For any root $\alpha$, irreducibility gives $[\mathbb{Q}(\alpha):\mathbb{Q}] = 5$, so 5 divides $[K:\mathbb{Q}] = |\mathrm{Gal}(f)|$. By Cauchy's theorem the group has an element of order 5, and the elements of order 5 in $S_5$ are exactly the 5-cycles.
5. **So it is all of $S_5$.** Label the roots so that the transposition is $(1\,2)$. Some power of the 5-cycle sends 1 to 2, and because 5 is prime that power is again a 5-cycle; after relabelling the other three roots it is $(1\,2\,3\,4\,5)$. Conjugating $(1\,2)$ by it gives $(2\,3)$, then $(3\,4)$ and $(4\,5)$, and adjacent transpositions generate $S_5$.

Therefore $\mathrm{Gal}(x^5 - 4x + 2) = S_5$, which is not solvable, and not one of the five roots can be written in terms of integers, the four arithmetic operations and radicals. (If one root could, the Galois closure of its tower would contain all five.)

## What the theorem does not say

**It does not say that quintics have no solutions.** By the fundamental theorem of algebra, $x^5 - 4x + 2$ has five complex roots, and they are easy to compute. Newton's method, $x_{k+1} = x_k - f(x_k)/f'(x_k)$, which here reads

$$
x_{k+1} = x_k - \frac{x_k^5 - 4x_k + 2}{5x_k^4 - 4},
$$

started at $x_0 = 0$ gives $0.5$, then $0.508474\ldots$, $0.508499484434\ldots$ and $0.508499484657\ldots$: the number of correct digits roughly doubles at every step. The other roots are approximately $-1.518512$, $1.243596$ and $-0.116792 \pm 1.438448\,i$.

**It does not say that no quintic can be solved by radicals.** Particular quintics can. The roots of $x^5 - 2$ are $\sqrt[5]{2}\,\zeta^k$ for $k = 0, 1, \dots, 4$, where $\zeta = e^{2\pi i/5}$, and $\zeta$ itself is expressible by radicals, for instance through $\cos(2\pi/5) = (\sqrt{5} - 1)/4$. The Galois group of $x^5 - 2$ has order 20 and is solvable: it has a normal cyclic subgroup of order 5 with a cyclic quotient of order 4. The theorem rules out a single formula that works for *every* quintic; Galois's criterion then decides, equation by equation, which ones are solvable.

**It does not say there is no closed form at all.** Only radicals are ruled out. Add one new function, the *Bring radical* (the unique real root of $x^5 + x + a = 0$ for real $a$, viewed as a function of $a$ and continued analytically to complex $a$), and every quintic can be solved in closed form. In 1858 Charles Hermite solved the quintic with elliptic modular functions, much as the cubic can be solved with trigonometric functions, and Felix Klein later explained the whole picture through the symmetries of the icosahedron, whose rotation group is exactly $A_5$.

## The takeaway: symmetry dictates solvability

A formula in radicals is a machine for undoing symmetry. Each radical breaks the symmetry among the roots by one abelian step, and a formula exists exactly when the group of symmetries can be taken apart that way. For degrees two, three and four the symmetric group comes apart into abelian pieces: $C_2$; then $C_2, C_3$; then $C_2, C_3, C_2, C_2$. From degree five on, the general equation carries a simple, non-abelian core, $A_n$, that no radical can split. The general quintic is not too complicated to solve; its symmetry is of a kind that radicals cannot undo.

## Further reading

- David S. Dummit and Richard M. Foote, <cite>Abstract Algebra</cite>, 3rd edition (Wiley, 2004), Chapter 14; Section 14.7 covers solvable and radical extensions and the insolvability of the quintic.
- Ian Stewart, <cite>Galois Theory</cite> (CRC Press): the theory developed alongside its history.
- V. B. Alekseev, <cite>Abel's Theorem in Problems and Solutions</cite>, based on the lectures of V. I. Arnold: a problem-driven route through groups, complex functions and Riemann surfaces.
- Niels Henrik Abel, <cite lang="fr">Mémoire sur les équations algébriques où on démontre l'impossibilité de la résolution de l'équation générale du cinquième degré</cite> (Christiania, 1824): the original proof, in a famously short pamphlet.
