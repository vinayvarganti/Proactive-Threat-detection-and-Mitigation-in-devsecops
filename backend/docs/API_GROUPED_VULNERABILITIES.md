# Grouped Vulnerabilities API Endpoint

## Overview

The `/api/vulnerabilities/grouped` endpoint provides vulnerability data organized by repository and scanner, optimized for dashboard rendering. This endpoint aggregates vulnerabilities and calculates summary statistics, eliminating the need for complex client-side data processing.

## Endpoint Details

**URL:** `GET /api/vulnerabilities/grouped`

**Authentication:** Required (session-based)

**Response Format:** JSON

## Response Structure

```typescript
interface GroupedVulnerabilitiesResponse {
  summary: {
    totalProjects: number;
    totalVulnerabilities: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  projects: ProjectVulnerabilities[];
}

interface ProjectVulnerabilities {
  repositoryId: string;
  repositoryName: string;
  totalVulnerabilities: number;
  scanners: ScannerVulnerabilities[];
}

interface ScannerVulnerabilities {
  scannerName: 'gitleaks' | 'semgrep' | 'trivy';
  totalCount: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  vulnerabilities: Vulnerability[];
}

interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  filePath: string;
  lineNumber: number;
  status: string;
  scannerName: string;
  description?: string;
}
```

## Example Response

```json
{
  "summary": {
    "totalProjects": 2,
    "totalVulnerabilities": 5,
    "criticalCount": 2,
    "highCount": 2,
    "mediumCount": 1,
    "lowCount": 0
  },
  "projects": [
    {
      "repositoryId": "507f1f77bcf86cd799439011",
      "repositoryName": "my-app",
      "totalVulnerabilities": 3,
      "scanners": [
        {
          "scannerName": "semgrep",
          "totalCount": 2,
          "severityBreakdown": {
            "critical": 1,
            "high": 1,
            "medium": 0,
            "low": 0
          },
          "vulnerabilities": [
            {
              "id": "507f1f77bcf86cd799439012",
              "severity": "critical",
              "title": "SQL Injection",
              "filePath": "/src/db/queries.ts",
              "lineNumber": 42,
              "status": "pending",
              "scannerName": "semgrep",
              "description": "Potential SQL injection vulnerability"
            }
          ]
        }
      ]
    }
  ]
}
```

## Data Aggregation Logic

### Grouping Hierarchy

1. **First Level - Repository:** Vulnerabilities are grouped by repository
2. **Second Level - Scanner:** Within each repository, vulnerabilities are grouped by scanner tool

### Summary Statistics

The `summary` object contains aggregate counts across all projects:

- `totalProjects`: Number of repositories with at least one vulnerability
- `totalVulnerabilities`: Total count of all vulnerabilities
- `criticalCount`: Count of critical severity vulnerabilities
- `highCount`: Count of high severity vulnerabilities
- `mediumCount`: Count of medium severity vulnerabilities
- `lowCount`: Count of low severity vulnerabilities

### Validation Rules

The endpoint ensures data consistency:

1. **Project totals match scanner totals:**
   ```
   project.totalVulnerabilities === sum(scanner.totalCount for all scanners)
   ```

2. **Scanner totals match vulnerability arrays:**
   ```
   scanner.totalCount === scanner.vulnerabilities.length
   ```

3. **Severity breakdown matches total:**
   ```
   scanner.totalCount === sum(scanner.severityBreakdown values)
   ```

4. **Summary matches all projects:**
   ```
   summary.totalVulnerabilities === sum(project.totalVulnerabilities for all projects)
   summary.criticalCount === sum(scanner.severityBreakdown.critical for all scanners)
   ```

## Error Responses

### 401 Unauthorized

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "retryable": false,
    "suggestedAction": "Please log in"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "abc123"
}
```

### 500 Internal Server Error

```json
{
  "error": {
    "code": "GROUPED_VULNERABILITIES_FAILED",
    "message": "Failed to fetch grouped vulnerabilities",
    "retryable": true,
    "suggestedAction": "Try again"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "abc123"
}
```

## Usage Examples

### JavaScript/TypeScript

```typescript
async function fetchGroupedVulnerabilities() {
  try {
    const response = await fetch('/api/vulnerabilities/grouped', {
      method: 'GET',
      credentials: 'include', // Include session cookie
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: GroupedVulnerabilitiesResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Failed to fetch grouped vulnerabilities:', error);
    throw error;
  }
}
```

### cURL

```bash
curl -X GET \
  http://localhost:3000/api/vulnerabilities/grouped \
  -H 'Content-Type: application/json' \
  -b 'connect.sid=your-session-cookie'
```

## Performance Considerations

### Database Queries

The endpoint performs the following database operations:

1. Find all scan reports for the authenticated user
2. Find all vulnerabilities for those scan reports (with repository population)

### Optimization Strategies

- Uses MongoDB indexes on `reportId` and `repositoryId` fields
- Populates only necessary repository fields (`name`, `fullName`, `githubRepoId`)
- Performs aggregation in-memory after fetching data

### Expected Response Time

- Small datasets (< 100 vulnerabilities): < 100ms
- Medium datasets (100-1000 vulnerabilities): 100-500ms
- Large datasets (> 1000 vulnerabilities): 500ms-2s

## Frontend Integration

### Dashboard Rendering

The response structure is optimized for dashboard rendering:

```typescript
function DashboardContainer() {
  const [data, setData] = useState<GroupedVulnerabilitiesResponse | null>(null);

  useEffect(() => {
    fetchGroupedVulnerabilities().then(setData);
  }, []);

  if (!data) return <Loading />;

  return (
    <>
      <SummaryCards summary={data.summary} />
      {data.projects.map(project => (
        <ProjectCard key={project.repositoryId} project={project} />
      ))}
    </>
  );
}
```

### No Client-Side Transformation Required

The data structure matches the UI hierarchy exactly:

- `summary` → Summary cards at the top
- `projects` → Project cards
- `scanners` → Scanner sections within each project card
- `vulnerabilities` → Vulnerability tables within each scanner section

## Requirements Validation

This endpoint satisfies the following requirements from the vulnerability dashboard redesign spec:

- **Requirement 8.1:** Groups vulnerabilities by repository
- **Requirement 8.2:** Groups vulnerabilities by scanner within each repository
- **Requirement 8.4:** Includes aggregate counts in the API response

## Testing

### Unit Tests

Located in: `backend/src/routes/vulnerability.routes.test.ts`

Tests cover:
- Authentication requirements
- Response structure validation
- Data aggregation logic
- Severity count calculations

### Manual Testing

Use the test script: `backend/test-grouped-endpoint.ts`

```bash
npx ts-node test-grouped-endpoint.ts
```

This script validates:
- Response structure
- Summary statistics accuracy
- Project and scanner count consistency
- Severity breakdown correctness

## Related Endpoints

- `GET /api/vulnerabilities` - List vulnerabilities with filters (flat structure)
- `GET /api/vulnerabilities/:id` - Get single vulnerability details
- `PATCH /api/vulnerabilities/:id` - Update vulnerability status

## Changelog

### Version 1.0.0 (2024-01-15)

- Initial implementation
- Supports grouping by repository and scanner
- Includes summary statistics
- Optimized for dashboard rendering
