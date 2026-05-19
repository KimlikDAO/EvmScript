# Abstract stack problem

As explained in [Functions](functions.md), an `.evm.ts` function body is
transpiled to an inline body and then lowered statement by statement. For each
statement, the binder calls into the solver to answer a concrete optimization
question:

> Given the values already on the stack, what is the minimum-cost sequence of
> opcodes that computes this expression while preserving the values that future
> statements still need?

We call this the abstract stack problem. It is "abstract" because the solver
does not reason about bytecode directly. Instead, it works with integer
identifiers for values and operations, then the binder turns the solution path
back into EVM fragments.

The dream version of compilation would be: given a specification, output the
best possible program. In the general Turing-complete setting, that function is
not merely expensive or NP-hard. It is uncomputable. The same wall appears in
Kolmogorov complexity and in the
[Busy Beaver function](https://wiki.bbchallenge.org/), which grows faster than
any computable function. Even for tiny Turing machines, the frontier is brutal:
for the standard two-symbol Busy Beaver, the exact 5-state value was only proved
in 2024, and no exact values are known beyond that.

The abstract stack problem is the deliberately finite version of this ambition,
but it is still a hard planning problem rather than a cosmetic peephole pass.
The decision version, "is there a valid sequence with cost at most `C`?", ranges
over an exponentially large graph of stack states. We suspect the general form
is PSPACE-complete, though that should be read as a complexity conjecture until
a reduction is written down.

EvmScript makes the problem tractable without giving up the ambition. The
optimization boundary is statement by statement, but that does **not** mean each
statement is optimized in isolation. Each statement is solved against the exact
stack signature produced by the code before it and a keep list computed from the
rest of the `.evm.ts` body. The search depends on both the past and the future.

That framework is expressive enough to generate programs that are better than
hand-written EVM assembly in almost all ordinary cases. Humans are not good at
exhaustively searching stack-machine choreography under `DUP`, `SWAP`, and
future-liveness constraints. EvmScript is built to search that space directly
and emit the best fragment in the modeled problem.

## The abstract problem

The solver input has this shape:

```typescript
interface ProblemData {
  readonly init: StackState;
  readonly keep: ValueId[];
  readonly output: ValueId;
  readonly rules: RuleInputs[];
}
```

The stack is represented as an array of integer value ids. The top of stack is
the rightmost element.

`ValueId`s have three roles:

* `0`: a blank stack slot, or hole.
* Negative ids: values that already exist on the initial stack.
* Positive ids: expression leaves or rule outputs that can be produced.

For a rule like:

```typescript
rules[7] = [2, -1, 4];
```

action `7` can run when the current abstract stack ends in `[2, -1, 4]`. It pops
that suffix and pushes `7`.

The solver's goal is to produce a final stack that ends with `output` and still
contains every negative id listed in `keep`, with the lowest total action cost
among all valid paths in the abstract model.

## From expressions to a problem

The binder converts the expression tree produced from `.evm.ts` syntax into
this integer problem:

* Current named stack values become negative ids.
* Expression nodes become positive ids.
* Expression dependencies become solver rules.
* Future stack references become `keep`.
* Literal and zero-input fragments become terminal positive actions.

After solving, the binder translates the optimal path back into fragments:

* primitive actions become `PUSH0`, `POP`, `DUPn`, or `SWAPn`;
* positive expression actions emit the fragment associated with that expression
  node;
* final stack ids are mapped back to EvmScript types and names.

## The solver

EvmScript currently uses a fast two-stage solver:

* A direct strategy handles common cases where all participating stack values
  are kept and the expression tree can be emitted in postorder with `DUP`s.
* An A* search handles harder cases that require stack rearrangement, blank
  slots, or selective popping.

The A* solver explores valid stack-action paths, scores states with a heuristic,
and stops when it reaches a stack that satisfies the output and keep
requirements. The goal is an admissible heuristic: with admissibility, A* is not
just a good-stack-choreography finder, it is an optimal-path search for the
modeled statement problem.

That is the bar for EvmScript code generation. The compiler should not settle
for "pretty good" stack motion when the abstract problem is small enough to
solve exactly. It should attack the statement, prove the cheapest route through
the modeled state space, and emit that route as bytecode.

## Future searchers

The state space will grow as EvmScript adds richer expression forms, especially
planned `MemoryForm` expression nodes. Those nodes will give the compiler more
ways to trade stack work against memory layout work.

As the search space grows, we expect to keep the A* solver as a strong baseline
and explore policy-guided search as well. One direction is an iterative
policy-learning searcher, AlphaZero-like in spirit, that learns which stack
actions are promising for the kinds of programs built with EvmScript.
