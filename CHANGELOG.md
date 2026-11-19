# Changelog

Notable changes to Lease Lawyer. The Kiro sessions and what they changed are recorded separately in [KIRO-LOG.md](KIRO-LOG.md).

## Unreleased

### Fixed
- Questions about small pets ("Can I keep a goldfish?", hamsters, birds, reptiles) are routed to the pets rules instead of being refused as out of scope.
- "Can I get my deposit back?" is routed to the deposit rules.
- A deposit clause that says the deposit is non-refundable, will not be refunded, or is forfeited is no longer treated as silent about deductions; the answer is "Can't tell" with the section named.
- An entry clause that says the landlord may enter "at any time" or "without notice" is no longer treated as silent about entry.
- The unit suite allows 20 seconds per test, so a cold first run of the Prolog engine cannot time out.
