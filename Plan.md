# GitLab Integration Implementation Plan

## Project Overview
Adapt the CloudFlare Workers container project to support comprehensive GitLab integration with multiple trigger types, providing both GitHub-style issue processing and GitLab-specific comment/MR features.

## Implementation Phases

---

## Phase 1: Analysis & Setup
**Objective:** Understand current architecture and plan GitLab integration approach

### 1.1 Architecture Analysis
- [x] Review current GitHub-focused codebase
  - [x] Analyze src/index.ts main worker logic
  - [x] Document current GitHub webhook handling
  - [x] Map GitHub API usage patterns
- [x] Study gitlab-claude project patterns
  - [x] Extract GitLab API integration patterns
  - [x] Document comment parsing logic
  - [x] Identify webhook event handling

### 1.2 GitLab Integration Research
- [x] GitLab webhook events documentation
  - [x] Issue events structure
  - [x] Note events (comments) structure
  - [x] Merge request events structure
- [x] GitLab API endpoints mapping
  - [x] Issues API
  - [x] Comments/Notes API
  - [x] Merge Requests API

### 1.3 Technical Planning
- [x] Create detailed technical specifications
  - [x] Define GitLab webhook event routing
  - [x] Plan authentication strategy (Personal Access Tokens)
  - [x] Design container communication protocol
- [x] Update project documentation
  - [x] Update CLAUDE.md with GitLab integration details
  - [x] Document new environment variables needed
  - [x] Create GitLab setup instructions

---

## Phase 2: Core GitLab Integration
**Objective:** Implement basic GitLab webhook handling and authentication

### 2.1 Worker Layer Foundation
- [x] Create GitLab webhook handler
  - [x] Create `src/handlers/gitlab_webhook.ts`
  - [x] Implement GitLab webhook signature verification
  - [x] Create event routing logic (issue/note/merge_request)
- [x] Setup GitLab authentication
  - [x] Create `src/handlers/gitlab_setup.ts`
  - [x] Implement GitLab Personal Access Token storage
  - [x] Update GitLabAppConfigDO for token management

### 2.2 GitLab API Client
- [x] Create GitLab API client
  - [x] Create `container_src/src/gitlab_client.ts`
  - [x] Implement connection pooling (based on gitlab-claude patterns)
  - [x] Add retry logic and error handling
  - [x] Create methods for issues, comments, MRs

### 2.3 Container Integration
- [x] Update container main logic
  - [x] Modify `container_src/src/main.ts` for GitLab context
  - [x] Add GitLab event processing modes
  - [x] Update environment variable handling
- [x] Create GitLab context formatters
  - [x] Issue context formatter
  - [x] Comment context formatter
  - [x] MR context formatter

---

## Phase 3: Trigger Type Implementation
**Objective:** Implement all GitLab trigger types (issues, comments, MRs)

### 3.1 GitLab Issues Processing (GitHub Parity)
- [ ] Issue webhook handler
  - [ ] Create `src/handlers/gitlab_webhooks/issue.ts`
  - [ ] Parse issue creation events
  - [ ] Extract issue context for Claude
- [ ] Issue processing logic
  - [ ] Adapt current GitHub issue processing for GitLab
  - [ ] Create GitLab MR instead of GitHub PR
  - [ ] Handle GitLab-specific issue fields

### 3.2 Comment Processing (@duo-agent)
- [ ] Comment detection system
  - [ ] Create `src/handlers/gitlab_webhooks/note.ts`
  - [ ] Implement @duo-agent mention parsing
  - [ ] Filter issue vs MR comments
  - [ ] Bot comment prevention logic
- [ ] Comment processing logic
  - [ ] Parse user prompts from @duo-agent mentions
  - [ ] Execute Claude Code with user-specified prompts
  - [ ] Handle threaded comment responses

### 3.3 MR Processing (Description Parsing)
- [ ] MR webhook handler
  - [ ] Create `src/handlers/gitlab_webhooks/merge_request.ts`
  - [ ] Parse MR creation events
  - [ ] Extract MR description instructions
- [ ] MR processing logic
  - [ ] Parse @duo-agent instructions from MR descriptions
  - [ ] Execute Claude Code on MR context
  - [ ] Handle MR updates and commits

---

## Phase 4: Advanced Features
**Objective:** Add sophisticated features and optimizations

### 4.1 Context-Aware Processing
- [ ] Smart context extraction
  - [ ] Extract relevant code context for comments
  - [ ] Include file/line information for MR comments
  - [ ] Add discussion thread context
- [ ] Intelligent response formatting
  - [ ] Format responses based on trigger type
  - [ ] Add code suggestions for MR comments
  - [ ] Include relevant links and references

### 4.2 Rate Limiting & Performance
- [ ] Implement rate limiting
  - [ ] Add cooldown periods (based on gitlab-claude patterns)
  - [ ] Prevent spam and loops
  - [ ] Track recent triggers
- [ ] Performance optimizations
  - [ ] Connection pooling for GitLab API
  - [ ] Optimize container startup times
  - [ ] Add caching where appropriate

### 4.3 Error Handling & Monitoring
- [ ] Comprehensive error handling
  - [ ] GitLab API error handling
  - [ ] Container failure recovery
  - [ ] Webhook failure notifications
- [ ] Monitoring and logging
  - [ ] Add structured logging
  - [ ] Create health check endpoints
  - [ ] Add metrics collection

---

## Phase 5: Testing & Validation
**Objective:** Comprehensive testing of all functionality

### 5.1 Unit Testing
- [ ] Worker layer tests
  - [ ] Test GitLab webhook handlers
  - [ ] Test authentication logic
  - [ ] Test event routing
- [ ] Container layer tests
  - [ ] Test GitLab API client
  - [ ] Test context processing
  - [ ] Test response formatting

### 5.2 Integration Testing
- [ ] End-to-end webhook testing
  - [ ] Test issue processing flow
  - [ ] Test comment processing flow
  - [ ] Test MR processing flow
- [ ] GitLab API integration testing
  - [ ] Test with real GitLab instance
  - [ ] Test authentication flows
  - [ ] Test error scenarios

### 5.3 Load Testing
- [ ] Performance testing
  - [ ] Test webhook handling under load
  - [ ] Test container scaling
  - [ ] Test rate limiting effectiveness
- [ ] Error scenario testing
  - [ ] Test network failures
  - [ ] Test API rate limits
  - [ ] Test malformed webhooks

---

## Phase 6: Documentation & Deployment
**Objective:** Complete documentation and deployment preparation

### 6.1 User Documentation
- [ ] Setup guides
  - [ ] GitLab integration setup
  - [ ] Environment variable configuration
  - [ ] Webhook configuration
- [ ] Usage documentation
  - [ ] How to use @duo-agent commands
  - [ ] MR description format examples
  - [ ] Troubleshooting guide

### 6.2 Developer Documentation
- [ ] Code documentation
  - [ ] API documentation
  - [ ] Architecture diagrams
  - [ ] Contributing guidelines
- [ ] Deployment documentation
  - [ ] CloudFlare Workers deployment
  - [ ] Container deployment
  - [ ] Monitoring setup

### 6.3 Examples & Templates
- [ ] Example configurations
  - [ ] Sample .env files
  - [ ] Example webhook configurations
  - [ ] Sample GitLab project setup
- [ ] Template projects
  - [ ] Starter project template
  - [ ] Advanced configuration examples
  - [ ] Custom prompt templates

---

## Success Criteria

### Phase 1 Success Criteria
- [ ] Complete understanding of current GitHub architecture
- [ ] Detailed GitLab integration plan documented
- [ ] Technical specifications created

### Phase 2 Success Criteria
- [ ] Basic GitLab webhook handling working
- [ ] Authentication system implemented
- [ ] GitLab API client functional

### Phase 3 Success Criteria
- [ ] All trigger types implemented and working
- [ ] Issue processing matches GitHub functionality
- [ ] Comment processing responds to @duo-agent
- [ ] MR processing handles description instructions

### Phase 4 Success Criteria
- [ ] Advanced features implemented
- [ ] Rate limiting and performance optimizations active
- [ ] Comprehensive error handling in place

### Phase 5 Success Criteria
- [ ] All tests passing
- [ ] Integration testing complete
- [ ] Load testing validates performance

### Phase 6 Success Criteria
- [ ] Complete documentation available
- [ ] Deployment ready
- [ ] Examples and templates provided

---

## Dependencies

### Phase Dependencies
- Phase 2 depends on Phase 1 completion
- Phase 3 depends on Phase 2 completion
- Phase 4 can run in parallel with Phase 3
- Phase 5 depends on Phase 3 completion
- Phase 6 can run in parallel with Phase 5

### External Dependencies
- GitLab instance for testing
- Claude API access
- CloudFlare Workers environment
- Docker for container testing

---

## Estimated Timeline

### Phase 1: Analysis & Setup (2-3 days)
- Architecture review and planning
- Technical specifications

### Phase 2: Core GitLab Integration (3-4 days)
- Basic webhook handling
- Authentication system

### Phase 3: Trigger Type Implementation (5-7 days)
- Issue processing
- Comment processing
- MR processing

### Phase 4: Advanced Features (3-4 days)
- Context-aware processing
- Rate limiting and performance

### Phase 5: Testing & Validation (4-5 days)
- Unit and integration testing
- Load testing

### Phase 6: Documentation & Deployment (2-3 days)
- Documentation completion
- Deployment preparation

**Total Estimated Timeline: 19-26 days**

---

## Current Status

**Phase 1: Analysis & Setup** - ✅ COMPLETED
- Architecture analysis complete
- GitLab integration research complete
- Technical planning complete
- Documentation updated

**Phase 2: Core GitLab Integration** - ✅ COMPLETED
- **2.1 Worker Layer Foundation** - ✅ COMPLETED (15/15 tests passing)
- **2.2 GitLab API Client** - ✅ COMPLETED (19/19 tests passing)  
- **2.3 Container Integration** - ✅ COMPLETED (12/12 tests passing)

**Next Steps:**
- Begin Phase 3: Trigger Type Implementation
- Implement GitLab issue processing (GitHub parity)
- Add comment processing (@duo-agent)
- Add MR processing (description parsing)