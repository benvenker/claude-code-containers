# GitLab Integration Demo Test Plan

## Overview
This document outlines comprehensive test scenarios for the GitLab + Claude Code integration. Check off items as you test them to track progress.

## Prerequisites Setup

### Initial Configuration
- [ ] **Deploy to Cloudflare**: Ensure latest version is deployed with `npm run deploy`
- [ ] **Configure Claude API Key**: Visit `/claude-setup` and configure Anthropic API key
- [ ] **Configure GitLab Integration**: Visit `/gitlab-setup` and configure Personal Access Token
- [ ] **Set up GitLab Webhook**: Point GitLab webhook to `https://your-worker.workers.dev/webhooks/gitlab`
- [ ] **Verify Container Status**: Check that containers are running and not hitting authorization errors

### GitLab Repository Setup
- [ ] **Create Test Repository**: Set up a GitLab repository for testing
- [ ] **Configure Webhook**: Add webhook with URL and secret token
- [ ] **Set Required Scopes**: Ensure token has `api`, `read_repository`, `write_repository` scopes
- [ ] **Test Webhook**: Verify webhook receives test events successfully

## Core GitLab Integration Tests

### 1. Issue Processing (GitHub Parity)
Test automatic processing of new GitLab issues.

#### Basic Issue Processing
- [ ] **Create Simple Issue**: Create a new issue with basic title and description
- [ ] **Verify Webhook Receipt**: Check logs that webhook was received and processed
- [ ] **Check Container Invocation**: Verify container was started for issue processing
- [ ] **Validate Response**: Check that Claude responded with analysis or MR creation

#### Complex Issue Processing
- [ ] **Create Issue with Code Context**: Include code snippets or stack traces
- [ ] **Issue with Multiple Labels**: Test with various GitLab labels
- [ ] **Issue with Assignees**: Test with assigned users
- [ ] **Issue with Large Description**: Test with comprehensive issue description

### 2. Comment Processing (@duo-agent)

#### Issue Comments
- [ ] **Basic @duo-agent Command**: Comment with `@duo-agent Please help with this issue`
- [ ] **Specific Task Request**: `@duo-agent Can you explain this error message?`
- [ ] **Code Analysis Request**: `@duo-agent Review this function: [code block]`
- [ ] **Multiple @duo-agent in Thread**: Test multiple commands in same discussion

#### Merge Request Comments
- [ ] **General MR Comment**: `@duo-agent Can you review this MR?`
- [ ] **Line-Specific Comment**: Comment on specific line with `@duo-agent`
- [ ] **File-Specific Comment**: Comment on specific file with `@duo-agent`
- [ ] **Code Suggestion Request**: `@duo-agent Suggest improvements for this code`

#### Comment Filtering Tests
- [ ] **System Note Filtering**: Verify system notes are ignored
- [ ] **Bot Comment Filtering**: Verify bot comments are ignored
- [ ] **Non-@duo-agent Comments**: Verify regular comments are ignored
- [ ] **Code Block Filtering**: Test `@duo-agent` inside code blocks (should be ignored)

### 3. Merge Request Processing

#### MR Creation with @duo-agent
- [ ] **Basic MR Instructions**: Create MR with `@duo-agent Please implement user authentication`
- [ ] **Detailed Requirements**: MR description with specific technical requirements
- [ ] **Feature Implementation**: `@duo-agent Add OAuth2 integration with these specs...`
- [ ] **Bug Fix Request**: `@duo-agent Fix the login issue described in issue #123`

#### MR Context Processing
- [ ] **Source Branch Processing**: Verify Claude works on the correct branch
- [ ] **Target Branch Awareness**: Check Claude understands merge target
- [ ] **Existing Code Context**: Test with MR that already has code changes
- [ ] **Merge Conflict Handling**: Test behavior with conflicting changes

### 4. Context-Aware Processing

#### File/Line Context
- [ ] **Line-Specific Comments**: Test comments on specific code lines
- [ ] **File Context Extraction**: Verify file content is included in context
- [ ] **Syntax Highlighting**: Check that responses include proper syntax highlighting
- [ ] **Language Detection**: Test with different programming languages (JS, Python, etc.)

#### Enhanced Response Formatting
- [ ] **Collapsible Sections**: Verify responses include collapsible sections
- [ ] **GitLab URL References**: Check that responses include links to GitLab resources
- [ ] **Code Suggestions**: Test that code suggestions are properly formatted
- [ ] **Discussion Thread Context**: Verify historical context is included

### 5. Multi-Project Support

#### Single Project Testing
- [ ] **Project-Specific Configuration**: Configure single project with unique token
- [ ] **Project Isolation**: Verify events only affect configured project
- [ ] **Project-Specific Webhooks**: Test webhook routing for specific project

#### Multi-Project Testing
- [ ] **Configure Multiple Projects**: Set up 2+ projects with different tokens
- [ ] **Cross-Project Isolation**: Verify projects don't interfere with each other
- [ ] **Project-Specific Responses**: Check responses are sent to correct project

#### Group-Level Support
- [ ] **Group Configuration**: Configure group-level token and settings
- [ ] **Auto-Discovery**: Test automatic project discovery within group
- [ ] **Group Fallback**: Test fallback from project-specific to group-level config

## Advanced Testing Scenarios

### 6. Error Handling

#### Authentication Errors
- [ ] **Invalid Token**: Test with revoked or invalid GitLab token
- [ ] **Insufficient Permissions**: Test with token lacking required scopes
- [ ] **Missing Claude API Key**: Test behavior without Claude API key
- [ ] **Invalid Webhook Secret**: Test with incorrect webhook secret

#### Processing Errors
- [ ] **Container Startup Failure**: Test behavior when container fails to start
- [ ] **Claude API Errors**: Test with invalid Claude API key or rate limits
- [ ] **GitLab API Errors**: Test with GitLab API downtime or rate limits
- [ ] **Network Connectivity**: Test with network interruptions

#### Edge Cases
- [ ] **Very Large Issues**: Test with extremely long issue descriptions
- [ ] **Special Characters**: Test with emojis, special characters, non-ASCII text
- [ ] **Concurrent Requests**: Test multiple simultaneous @duo-agent requests
- [ ] **Malformed @duo-agent**: Test with malformed or incomplete @duo-agent syntax

### 7. Performance Testing

#### Container Performance
- [ ] **Container Startup Time**: Measure and verify container startup is reasonable
- [ ] **Memory Usage**: Monitor container memory usage during processing
- [ ] **Container Scaling**: Test multiple concurrent container instances
- [ ] **Container Optimization**: Verify 566MB image size is maintained

#### Response Times
- [ ] **Webhook Response Time**: Verify webhooks respond within 30 seconds
- [ ] **Issue Processing Time**: Measure time from issue creation to Claude response
- [ ] **Comment Processing Time**: Measure @duo-agent response time
- [ ] **MR Processing Time**: Measure MR creation to Claude response time

### 8. Integration Testing

#### End-to-End Workflows
- [ ] **Complete Issue Workflow**: Issue creation → Claude analysis → MR creation → Review
- [ ] **Comment Thread Workflow**: Issue → Comment → @duo-agent → Response → Follow-up
- [ ] **MR Development Workflow**: MR creation → @duo-agent → Implementation → Review
- [ ] **Multi-Platform Workflow**: Test GitHub and GitLab simultaneously

#### Real-World Scenarios
- [ ] **Bug Report Processing**: Test with actual bug reports from real projects
- [ ] **Feature Request Processing**: Test with realistic feature requests
- [ ] **Code Review Assistance**: Test @duo-agent for actual code reviews
- [ ] **Documentation Requests**: Test Claude generating/updating documentation

## Security Testing

### 9. Security Validation

#### Authentication Security
- [ ] **Token Encryption**: Verify tokens are encrypted in Durable Objects
- [ ] **Webhook Security**: Test webhook signature validation
- [ ] **Access Control**: Verify users can only access their configured projects
- [ ] **Rate Limiting**: Test protection against spam/abuse

#### Data Security
- [ ] **Sensitive Data Handling**: Verify no secrets are logged or exposed
- [ ] **Code Privacy**: Ensure code context is properly isolated
- [ ] **Cross-Project Security**: Verify no data leakage between projects
- [ ] **Container Security**: Test container isolation and security

## Monitoring and Logging

### 10. Observability Testing

#### Logging
- [ ] **Webhook Logging**: Verify comprehensive webhook event logging
- [ ] **Container Logging**: Check container execution logs
- [ ] **Error Logging**: Verify errors are properly logged with context
- [ ] **Performance Logging**: Check timing and performance metrics

#### Monitoring
- [ ] **Health Checks**: Test application health check endpoints
- [ ] **Container Health**: Monitor container health and restart behavior
- [ ] **API Rate Limiting**: Monitor API usage and rate limit compliance
- [ ] **Resource Usage**: Monitor memory, CPU, and other resource usage

## Test Results Tracking

### Overall Integration Health
- [ ] **All Basic Features Working**: Core issue, comment, and MR processing
- [ ] **Error Handling Robust**: Graceful handling of common error scenarios
- [ ] **Performance Acceptable**: Response times within acceptable limits
- [ ] **Security Validated**: No security vulnerabilities identified
- [ ] **Documentation Accurate**: All documentation reflects actual behavior

### Known Issues/Limitations
- [ ] **Document Known Issues**: Record any discovered limitations
- [ ] **Performance Bottlenecks**: Note any performance issues found
- [ ] **Feature Gaps**: Identify missing features or edge cases
- [ ] **Improvement Opportunities**: Note areas for future enhancement

## Next Steps
- [ ] **Production Readiness**: Evaluate readiness for production deployment
- [ ] **User Documentation**: Create user guides based on test results
- [ ] **Feature Roadmap**: Plan next features based on testing insights
- [ ] **Monitoring Setup**: Implement production monitoring based on test learnings

---

## Notes Section
*Use this space to add notes, observations, or additional test scenarios during testing.*