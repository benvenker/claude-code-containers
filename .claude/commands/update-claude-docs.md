# Update CLAUDE.md Documentation

<task>
You are a documentation maintainer responsible for keeping CLAUDE.md files across the project organized, current, and appropriately sized. You analyze git history to understand what has changed and update documentation accordingly.
</task>

<context>
This command maintains the project's CLAUDE.md documentation system by:
- Discovering all existing CLAUDE.md files
- Analyzing git changes to understand what needs updating
- Updating documentation based on code/structure changes
- Breaking up overly long files using import syntax (@path/to/file.md)
- Creating new CLAUDE.md files in subdirectories as needed

Key principles:
- Keep any single CLAUDE.md file under 500 lines when possible
- Use import syntax to reference other documentation
- Maintain clear project navigation through documentation
- Ensure documentation reflects current codebase state
</context>

<workflow>
Use subagents and follow the below plan:

## Phase 1: Discovery and Analysis

1. **Find all CLAUDE.md files**:
   Use Glob to find: `**/CLAUDE.md`
   
2. **Read main project CLAUDE.md**:
   Start with `/CLAUDE.md` to understand current structure
   
3. **Analyze recent changes**:
   Use Bash: `git diff --name-only HEAD~10..HEAD` to see changed files
   Use Bash: `git log --oneline -10` to understand recent work
   
4. **Check directory structure**:
   Use LS to understand current project organization

## Phase 2: Content Analysis

1. **Evaluate each CLAUDE.md file**:
   - Check line count (target: under 500 lines)
   - Identify sections that could be extracted
   - Look for outdated information based on git changes
   
2. **Identify documentation gaps**:
   - New directories without CLAUDE.md files
   - Changed functionality not reflected in docs
   - Missing cross-references between files

## Phase 3: Updates and Reorganization

1. **Update existing CLAUDE.md files**:
   - Reflect recent code changes
   - Update command examples and workflows
   - Fix broken references
   
2. **Break up overly long files**:
   ```markdown
   # Instead of long content, use imports:
   @docs/detailed-feature-guide.md
   @src/api/README.md
   ```
   
3. **Create new CLAUDE.md files**:
   - In new directories that need documentation
   - For extracted sections from main files
   
4. **Update import references**:
   - Ensure all @path/to/file.md references are valid
   - Create navigation between related files

## Phase 4: Validation

1. **Check file lengths**:
   - Verify no CLAUDE.md exceeds 500 lines
   - Ensure extracted content is properly imported
   
2. **Validate references**:
   - Test all @path imports exist
   - Check cross-references work
   
3. **Verify completeness**:
   - All major directories have appropriate documentation
   - Recent changes are reflected in documentation
</workflow>

<implementation_guidelines>
## File Length Targets
- Main `/CLAUDE.md`: 200-300 lines (high-level overview + imports)
- Directory CLAUDE.md: 100-200 lines (focused on that area)
- Feature-specific docs: 300-500 lines maximum

## Import Syntax Usage
```markdown
# Good: Reference detailed docs
For complete technical specifications: @docs/technical-specifications.md

# Good: Reference directory-specific info  
Container implementation details: @container_src/CLAUDE.md

# Good: Reference related features
GitLab API client documentation: @docs/features/gitlab-api-client.md
```

## Content Organization Principles
1. **Main CLAUDE.md**: Project overview, quick start, key concepts
2. **Directory CLAUDE.md**: Specific to that directory's purpose
3. **Feature docs**: Detailed implementation guides
4. **Extracted sections**: When main files get too long

## Git History Analysis
```bash
# Understand what changed recently
git diff --name-only HEAD~10..HEAD

# Look for new directories
git log --name-status --oneline -10

# Check for deleted files that might need doc updates
git log --diff-filter=D --summary HEAD~10..HEAD
```
</implementation_guidelines>

<example_workflow>
## Example: After GitLab Integration Work

1. **Discovery**:
   - Found: `/CLAUDE.md`, `/container_src/CLAUDE.md`, `/src/CLAUDE.md`
   - Git shows: New files in `/docs/features/`, updates to `/src/handlers/gitlab_*`

2. **Analysis**:
   - Main CLAUDE.md is 400 lines (good)
   - Container CLAUDE.md mentions old GitHub-only workflow
   - No documentation for new GitLab webhook handlers

3. **Updates**:
   - Update container_src/CLAUDE.md with GitLab integration details
   - Create src/handlers/CLAUDE.md for webhook documentation
   - Add import in main CLAUDE.md: @src/handlers/CLAUDE.md

4. **Result**:
   ```markdown
   # /CLAUDE.md (updated)
   ## GitLab Integration
   
   For detailed webhook handling: @src/handlers/CLAUDE.md
   For container GitLab processing: @container_src/CLAUDE.md
   
   # /src/handlers/CLAUDE.md (new)
   # GitLab Webhook Handlers
   
   This directory contains GitLab webhook processing logic...
   ```
</example_workflow>

<execution_approach>
1. **Start with discovery**: Use Glob and Read to understand current state
2. **Analyze changes**: Use Bash git commands to understand recent work  
3. **Make targeted updates**: Focus on areas that changed
4. **Organize content**: Break up long files, create new ones as needed
5. **Validate results**: Check lengths, test imports, verify coverage

Always prefer incremental updates over wholesale rewrites. The goal is to keep documentation current and well-organized, not to completely restructure existing good documentation.
</execution_approach>

<error_handling>
## Common Issues and Solutions

1. **Broken imports**: 
   - Always verify @path/to/file.md exists before adding import
   - Use relative paths from the importing file's location

2. **Circular references**:
   - Avoid A imports B imports A scenarios
   - Create a clear hierarchy: main → directory → feature docs

3. **Outdated content**:
   - When in doubt, mark sections with TODO for human review
   - Don't delete information that might still be relevant

4. **New directories**:
   - Not every directory needs a CLAUDE.md
   - Focus on directories with significant functionality
</error_handling>