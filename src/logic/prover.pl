% Lease Lawyer proof engine.
%
% A small meta-interpreter over rule/3. Proving a goal returns the proof tree
% as a Prolog term, so every answer comes with the exact facts and rules that
% produced it. Mode is one of:
%   strict  - only what the lease and the tenant actually said
%   tenant  - may also assume yes/no answers about the tenant (abduction)
%   lease   - may also assume lease facts that the lease never states
% Assumptions are collected in a list so the app can ask for them.

:- dynamic(lease_fact/2).
:- dynamic(tenant_fact/3).

prove(true, true, _, A, A) :- !.
prove((G1, G2), and(P1, P2), M, A0, A) :- !,
    prove(G1, P1, M, A0, A1),
    prove(G2, P2, M, A1, A).

% Facts read from the lease. Each one carries the id of its citation.
prove(lease(F), lease(F, Id), _, A, A) :- lease_fact(F, Id).
prove(lease(F), assumed(lease(F)), lease, A, [lease(F)|A]) :-
    \+ lease_fact(F, _), \+ in_list(absent(F), A).

% Closed world over the lease: the lease was read in full.
prove(absent(F), absent(F), _, A, A) :-
    \+ lease_fact(F, _), \+ in_list(lease(F), A).

% Facts about the tenant, from the question or from a follow-up answer.
prove(told(X), told(X, Src), _, A, A) :- tenant_fact(X, yes, Src).
prove(told(X), assumed(told(X)), M, A, A1) :-
    M \== strict, \+ tenant_fact(X, _, _), assume(told(X), A, A1).
prove(denied(X), denied(X, Src), _, A, A) :- tenant_fact(X, no, Src).
prove(denied(X), assumed(denied(X)), M, A, A1) :-
    M \== strict, \+ tenant_fact(X, _, _), assume(denied(X), A, A1).
prove(not_told(X), not_told(X), _, A, A) :- \+ tenant_fact(X, yes, _).

% Arithmetic. Under assumption, an unbound comparison is taken on trust.
prove(calc(C), calc(C), _, A, A) :- ground_enough(C), !, call(C).
prove(calc(C), assumed(calc(C)), M, A, A) :- M == lease.

% Rules of the model jurisdiction.
prove(G, rule(Id, G, P), M, A0, A) :-
    rule(Id, G, Body),
    prove(Body, P, M, A0, A).

assume(told(X), A, A) :- in_list(told(X), A), !.
assume(denied(X), A, A) :- in_list(denied(X), A), !.
assume(told(X), A, [told(X)|A]) :- \+ in_list(denied(X), A).
assume(denied(X), A, [denied(X)|A]) :- \+ in_list(told(X), A).

ground_enough(_ is E) :- !, ground(E).
ground_enough(C) :- ground(C).

in_list(X, [Y|_]) :- X == Y, !.
in_list(X, [_|T]) :- in_list(X, T).

% Entry points used by the app.
strict_proof(Topic, Verdict, Proof) :-
    once(prove(verdict(Topic, Verdict), Proof, strict, [], _)).

assumption_sets(Topic, Verdict, Mode, Sets) :-
    findall(As, prove(verdict(Topic, Verdict), _, Mode, [], As), Sets).
