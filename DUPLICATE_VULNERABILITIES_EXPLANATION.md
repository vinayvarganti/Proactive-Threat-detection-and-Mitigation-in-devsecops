# Duplicate Vulnerabilities Explanation

## What's Happening

When you scan the same repository multiple times, each scan creates a NEW set of vulnerability records in the database. This is intentional behavior for tracking scan history over time.

## Why This Happens

1. Each scan creates a new `ScanReport` document
2. Each scan creates new `Vulnerability` documents linked to that report
3. This allows you to track how vulnerabilities change over time
4. You can see if new vulnerabilities were introduced or old ones were fixed

## How to View Non-Duplicate Data

### Option 1: View Specific Scan Reports (Recommended)
- Go to "Scan History" tab
- Click on a specific report to see vulnerabilities from that scan only
- This shows a snapshot of vulnerabilities at that point in time

### Option 2: Use the Dashboard View
- The "Vulnerabilities" tab uses `DashboardContainer`
- This component groups vulnerabilities by repository and scanner
- It provides a better organized view of all vulnerabilities

### Option 3: View Latest Scan Only
Currently, the system shows ALL vulnerabilities from ALL scans. If you want to see only the latest scan results:

**Backend Solution**: Modify the vulnerability query to only fetch vulnerabilities from the most recent scan report for each repository.

## Current Behavior is Correct

The "duplicate" vulnerabilities you're seeing are actually:
- Historical records from different scans
- Useful for tracking vulnerability trends
- Important for compliance and audit trails

## If You Want to Remove Old Scans

You can manually delete old scan reports from the database, which will also remove their associated vulnerabilities.

## Recommendation

Use the "Scan History" view to see individual scan results without duplicates. Each report card shows vulnerabilities from that specific scan only.
