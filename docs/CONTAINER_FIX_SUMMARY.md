# Container Memory Fix Summary

## Problem
The container was experiencing memory issues causing:
- "The container is not listening in the TCP address 10.0.0.1:8080" errors
- Repeated "Alarm" messages
- Request cancellations
- Container crashes due to OOM (Out of Memory)

## Root Cause
The default container instance type only provides 256 MiB of memory, which is insufficient for our container that includes:
- Claude Code SDK
- Node.js runtime
- Python 3
- Git
- Other dependencies

## Solution
Updated `wrangler.jsonc` to use the "basic" instance type:

```json
"containers": [
  {
    "class_name": "MyContainer",
    "image": "./Dockerfile",
    "max_instances": 10,
    "name": "claude-code-containers",
    "instance_type": "basic"  // <-- Added this line
  }
]
```

## Instance Types Available
- `dev` (default): 256 MiB memory
- `basic`: 1 GiB memory  
- `standard`: 2 GiB memory
- `professional`: 4 GiB memory

## Testing the Fix
To verify the fix works:

1. Create a new GitLab issue to trigger the webhook
2. Monitor logs with: `npx wrangler tail --format=pretty`
3. Check for:
   - No more "container is not listening" errors
   - No repeated alarm messages
   - Successful container startup and processing
   - Completed GitLab API calls

## Additional Considerations
If the container still runs out of memory with "basic" instance type, consider:
1. Upgrading to "standard" instance type (2 GiB)
2. Further optimizing the container image size
3. Reducing memory usage in the application code