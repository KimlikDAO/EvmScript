# The Solver

As explained in [fuctions.md](fuctions.md "mention"), in a body, each statement is lowered to an explicit fragment by a call to `bind(preSig, expr, keep)`. The binder converts the task of finding the optimal fragment computing the value of `expr` to a simple integer valued abstract stack problem.

The abstract problem instance is passed to the solver, which performs a A\* search to find an optimal or near-optimal solution.

#### The abstract problem

{% code expandable="true" %}
```typescript
interface ProblemData {
  
}
```
{% endcode %}

