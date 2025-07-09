# Container Size Optimization Plan

## Current Issues (1.27GB total)
- **Duplicate Claude Code**: Global + local dependency
- **Dev dependencies**: Jest, TypeScript, etc. in production
- **Unnecessary system packages**: build-essential, python3-pip, etc.

## Optimization Strategy

### 1. Remove Duplicate Claude Code (Save ~251MB)
- Remove global install, use only local dependency
- OR remove local dependency, use only global install

### 2. Production-only Dependencies (Save ~100-200MB)
- Use `npm ci --only=production` 
- Remove jest, typescript, ts-jest from final image

### 3. Minimal System Packages (Save ~200MB)
- Remove build-essential (only needed for compilation)
- Remove python3-pip (only needed for build)
- Keep only: python3, git, ca-certificates, curl

### 4. Multi-stage Build Optimization
- Build stage: Full dependencies for compilation
- Production stage: Only runtime dependencies

## Expected Final Size: ~800MB (vs current 1.27GB)
This should easily fit under the 2GB limit with 1.2GB to spare.