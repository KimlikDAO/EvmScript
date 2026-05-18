# Abstract stack problem

As explained in [Functions](functions.md), an inline body is eventually lowered
statement by statement. For each statement, the binder calls into the solver to
answer a concrete question:

> Given the values already on the stack, which stack actions and expression
> fragments should we emit to compute this expression while preserving the
> values that future statements still need?

We call this the abstract stack problem. It is "abstract" because the solver does
not reason about bytecode directly. Instead, it works with integer identifiers
for values and operations, then the binder turns the solution path back into EVM
fragments.

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
contains every negative id listed in `keep`.

## From expressions to a problem

The binder converts an EvmScript expression tree into this integer problem:

* Current named stack values become negative ids.
* Expression nodes become positive ids.
* Expression dependencies become solver rules.
* Future stack references become `keep`.
* Literal and zero-input fragments become terminal positive actions.

After solving, the binder translates the chosen actions back into fragments:

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
requirements. In practice this performs very well for the stack problems created
by current EvmScript expressions.

## Future searchers

The state space will grow as EvmScript adds richer expression forms, especially
planned `MemoryForm` expression nodes. Those nodes will give the compiler more
ways to trade stack work against memory layout work.

As the search space grows, we expect to keep the A* solver as a strong baseline
and explore policy-guided search as well. One direction is an iterative
policy-learning searcher, AlphaZero-like in spirit, that learns which stack
actions are promising for the kinds of programs EvmScript users actually write.
