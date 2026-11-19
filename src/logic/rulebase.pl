% Model Jurisdiction rule base for residential tenancies.
%
% This is a teaching rule base for an invented "model jurisdiction". It is
% loosely patterned on common features of US residential landlord-tenant law,
% but it is not the law of any state and it is not legal advice. Real rules
% vary by state and city.
%
% rule(Id, Head, Body).  Body goals:
%   lease(F)      the lease states fact F (cited to a clause)
%   absent(F)     the lease, read in full, never states F
%   told(X)       the tenant says X is true
%   denied(X)     the tenant says X is false
%   not_told(X)   the tenant has not said X is true
%   calc(C)       an arithmetic test or calculation
% Plain-English text for every rule id lives in src/logic/rules.ts.

% --- General provisions -----------------------------------------------------

rule(mj_1_6, unenforceable(Term), waives_statutory_right(Term)).

% --- Security deposits (Part 3) ---------------------------------------------

rule(wear_clause_void, verdict(wear_and_tear, no),
     ( lease(security_deposit(_)),
       lease(deposit_deduction(normal_wear_and_tear)),
       unenforceable(deposit_deduction(normal_wear_and_tear)) )).
rule(wear_lease_agrees, verdict(wear_and_tear, no),
     ( lease(security_deposit(_)),
       lease(deposit_deduction(damage_beyond_wear)),
       wear_not_deductible )).
rule(wear_statute, verdict(wear_and_tear, no),
     ( lease(security_deposit(_)),
       absent(deposit_deduction(_)),
       wear_not_deductible )).
rule(wear_no_deposit, verdict(wear_and_tear, no),
     absent(security_deposit(_))).
rule(mj_3_4, wear_not_deductible, true).
rule(mj_3_4_waiver, waives_statutory_right(deposit_deduction(normal_wear_and_tear)),
     wear_not_deductible).

% --- Rent and late fees (Part 4) --------------------------------------------

rule(late_fee_ok, verdict(late_fee, yes),
     ( lease(late_fee(Fee)), lease(monthly_rent(Rent)),
       late_fee_cap(Rent, Cap), calc(Fee =< Cap),
       lease(late_fee_grace_days(Days)), grace_floor(Min), calc(Days >= Min) )).
rule(late_fee_ok_default_grace, verdict(late_fee, yes),
     ( lease(late_fee(Fee)), lease(monthly_rent(Rent)),
       late_fee_cap(Rent, Cap), calc(Fee =< Cap),
       absent(late_fee_grace_days(_)), grace_floor(_) )).
rule(late_fee_too_high, verdict(late_fee, no),
     ( lease(late_fee(Fee)), lease(monthly_rent(Rent)),
       late_fee_cap(Rent, Cap), calc(Fee > Cap) )).
rule(late_fee_grace_too_short, verdict(late_fee, no),
     ( lease(late_fee(_)), lease(late_fee_grace_days(Days)),
       grace_floor(Min), calc(Days < Min) )).
rule(late_fee_not_in_lease, verdict(late_fee, no),
     ( absent(late_fee(_)), fees_must_be_in_lease )).
rule(mj_4_3, late_fee_cap(Rent, Cap), calc(Cap is Rent * 0.05)).
rule(mj_4_3_grace, grace_floor(5), true).
rule(mj_4_1, fees_must_be_in_lease, true).

% --- Rent increases (Part 4) ------------------------------------------------

rule(raise_fixed_term, verdict(rent_increase, no),
     ( lease(term(fixed)), absent(rent_escalation_percent(_)), fixed_term_rent_locked )).
rule(raise_by_clause, verdict(rent_increase, yes),
     ( lease(term(fixed)), lease(rent_escalation_percent(_)), fixed_term_rent_locked )).
rule(raise_month_to_month, verdict(rent_increase, yes),
     ( lease(term(month_to_month)), increase_notice_days(_) )).
rule(mj_4_5, fixed_term_rent_locked, true).
rule(mj_4_6, increase_notice_days(30), true).

% --- Landlord entry (Part 5) ------------------------------------------------

rule(entry_emergency, verdict(entry_without_notice, yes),
     ( told(emergency), emergency_entry )).
rule(entry_lease_notice, verdict(entry_without_notice, no),
     ( not_told(emergency), lease(entry_notice_hours(Hours)),
       entry_notice_floor(Min), calc(Hours >= Min) )).
rule(entry_short_notice_void, verdict(entry_without_notice, no),
     ( not_told(emergency), lease(entry_notice_hours(Hours)),
       unenforceable(entry_notice_hours(Hours)) )).
rule(entry_statute, verdict(entry_without_notice, no),
     ( not_told(emergency), absent(entry_notice_hours(_)), entry_notice_floor(_) )).
rule(mj_5_1, entry_notice_floor(24), true).
rule(mj_5_1_waiver, waives_statutory_right(entry_notice_hours(Hours)),
     ( entry_notice_floor(Min), calc(Hours < Min) )).
rule(mj_5_2, emergency_entry, true).

% --- Ending the lease early (Part 6) ----------------------------------------

rule(leave_any_reason, verdict(early_termination, yes),
     lease(early_termination_option(any, _, _))).
rule(leave_job_relocation, verdict(early_termination, yes),
     ( told(job_transfer), lease(early_termination_option(job_relocation, _, _)) )).
rule(leave_military, verdict(early_termination, yes),
     ( told(military_orders), military_release )).
rule(leave_no_option, verdict(early_termination, no),
     ( absent(early_termination_option(_, _, _)), denied(military_orders), mitigation_duty )).
rule(leave_relocation_only, verdict(early_termination, no),
     ( lease(early_termination_option(job_relocation, _, _)),
       absent(early_termination_option(any, _, _)),
       denied(job_transfer), denied(military_orders), mitigation_duty )).
rule(mj_6_2, military_release, true).
rule(mj_6_4, mitigation_duty, true).

% --- Pets and assistance animals (Part 7) -----------------------------------

rule(pets_assistance_animal, verdict(pets, yes),
     ( told(assistance_animal), accommodation_required )).
rule(pets_allowed, verdict(pets, yes), lease(pet_policy(allowed))).
rule(pets_with_consent, verdict(pets, yes), lease(pet_policy(consent_required))).
rule(pets_lease_silent, verdict(pets, yes),
     ( absent(pet_policy(_)), silent_pets_allowed )).
rule(pets_prohibited, verdict(pets, no),
     ( lease(pet_policy(prohibited)), denied(assistance_animal) )).
rule(mj_7_1, accommodation_required, true).
rule(mj_7_3, silent_pets_allowed, true).

% --- Subletting (Part 8) ----------------------------------------------------

rule(sublet_prohibited, verdict(sublet, no), lease(sublet_policy(prohibited))).
rule(sublet_with_consent, verdict(sublet, yes),
     ( lease(sublet_policy(consent_required)), consent_not_unreasonably_withheld )).
rule(sublet_allowed, verdict(sublet, yes), lease(sublet_policy(allowed))).
rule(sublet_lease_silent, verdict(sublet, yes),
     ( absent(sublet_policy(_)), silent_sublet_with_notice )).
rule(mj_8_2, consent_not_unreasonably_withheld, true).
rule(mj_8_3, silent_sublet_with_notice, true).

% --- Repairs (Part 10) ------------------------------------------------------

rule(repair_deduct_waiver_void, verdict(repair_and_deduct, yes),
     ( told(essential_repair), told(written_notice),
       lease(repair_deduct_waiver), unenforceable(repair_deduct_waiver),
       lease(monthly_rent(Rent)), repair_deduct_limit(Rent) )).
rule(repair_deduct_allowed, verdict(repair_and_deduct, yes),
     ( told(essential_repair), told(written_notice),
       absent(repair_deduct_waiver),
       lease(monthly_rent(Rent)), repair_deduct_limit(Rent) )).
rule(repair_notice_first, verdict(repair_and_deduct, no),
     ( told(essential_repair), denied(written_notice), repair_notice_required )).
rule(repair_not_essential, verdict(repair_and_deduct, no),
     ( denied(essential_repair), repair_remedy_scope )).
rule(mj_10_2, repair_deduct_limit(_), true).
rule(mj_10_2_notice, repair_notice_required, true).
rule(mj_10_2_scope, repair_remedy_scope, true).
rule(mj_10_2_waiver, waives_statutory_right(repair_deduct_waiver), true).
