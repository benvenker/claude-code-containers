# GitLab Claude Code Demo Scenarios

These scenarios demonstrate the key features of the GitLab integration with Claude Code. Each scenario includes setup, execution, and expected outcomes.

## 🎯 Scenario 1: Automatic Issue Processing

**Objective**: Show how Claude automatically analyzes and responds to new GitLab issues.

### Setup
Create a new issue in GitLab with:
- **Title**: "Implement user authentication system"
- **Description**:
  ```
  We need to add user authentication to our REST API. Requirements:
  - JWT-based authentication
  - User registration and login endpoints
  - Password hashing with bcrypt
  - Session management
  - Role-based access control (admin, user)
  ```

### Expected Result
Claude will automatically:
1. Analyze the issue requirements
2. Create a detailed implementation plan
3. Potentially create a merge request with starter code
4. Or post a comprehensive comment with architecture suggestions

### Demo Talk Track
"When we create a new issue in GitLab, Claude automatically analyzes it and provides actionable guidance. Notice how it understands the technical requirements and suggests best practices for authentication."

---

## 💬 Scenario 2: Interactive Comment Assistance

**Objective**: Demonstrate @duo-agent mention for on-demand help.

### Setup
On an existing issue about database optimization, add a comment:
```
@duo-agent Can you explain the differences between database indexing strategies and recommend which one would be best for a user search feature that needs to support partial name matching?
```

### Expected Result
Claude will respond in the comment thread with:
- Explanation of different indexing strategies
- Specific recommendations for partial matching
- Example SQL/code snippets
- Performance considerations

### Demo Talk Track
"Team members can ask Claude questions directly in issue comments using @duo-agent. This keeps technical discussions in context and helps the entire team learn together."

---

## 🔀 Scenario 3: Merge Request Review

**Objective**: Show how Claude can review and improve merge requests.

### Setup
Create a merge request with:
- **Title**: "Add error handling to API endpoints"
- **Description**:
  ```
  @duo-agent Please review this MR and suggest improvements for:
  - Error handling patterns
  - HTTP status code usage
  - Error message formatting
  - Logging best practices
  
  The code currently has basic try-catch blocks but needs to be more robust.
  ```

### Expected Result
Claude will:
1. Analyze the MR code changes
2. Provide specific feedback on error handling
3. Suggest improvements with code examples
4. Reference best practices and standards

### Demo Talk Track
"Claude can review merge requests when mentioned in the description. It provides specific, actionable feedback that helps maintain code quality and teaches best practices."

---

## 🐛 Scenario 4: Debugging Assistance

**Objective**: Show Claude helping debug a specific issue.

### Setup
Create an issue with:
- **Title**: "API returns 500 error on user login"
- **Description**:
  ```
  Users are getting a 500 error when trying to login. The error logs show:
  
  ```
  TypeError: Cannot read property 'id' of undefined
    at AuthController.login (auth.controller.js:45:23)
    at processTicksAndRejections (internal/process/task_queues.js:95:5)
  ```
  
  This started happening after the latest deployment.
  ```

### Expected Result
Claude will:
1. Analyze the error message
2. Identify potential causes
3. Suggest debugging steps
4. Provide code fixes if possible

### Demo Talk Track
"Claude can help debug production issues by analyzing error messages and logs. It understands stack traces and can suggest both immediate fixes and prevention strategies."

---

## 📚 Scenario 5: Architecture Consultation

**Objective**: Demonstrate Claude's ability to provide architectural guidance.

### Setup
Add a comment to a planning issue:
```
@duo-agent We're planning to migrate from a monolithic architecture to microservices. Can you help us plan the migration strategy for our e-commerce platform? We currently have user management, product catalog, orders, and payment processing all in one application.
```

### Expected Result
Claude will provide:
1. Phased migration approach
2. Service boundary recommendations
3. Communication patterns (REST/gRPC/messaging)
4. Data management strategies
5. Deployment considerations

### Demo Talk Track
"Claude can provide strategic technical guidance for complex architectural decisions. It considers your specific context and provides practical, actionable advice."

---

## 🔧 Scenario 6: Code Refactoring Help

**Objective**: Show Claude helping improve existing code.

### Setup
In an MR comment on a specific file/line:
```
@duo-agent This function has grown too complex. Can you suggest how to refactor it following SOLID principles?
```

### Expected Result
Claude will:
1. Analyze the complex function
2. Suggest refactoring strategies
3. Provide refactored code examples
4. Explain the benefits of each change

### Demo Talk Track
"Claude can help refactor complex code by applying software engineering principles. It provides not just the 'what' but also the 'why' behind each suggestion."

---

## 📊 Demo Metrics to Highlight

During the demo, emphasize these benefits:

1. **Time Savings**: "What typically takes 30-60 minutes of research can be answered in seconds"
2. **Knowledge Sharing**: "Every interaction teaches the team and builds institutional knowledge"
3. **Consistency**: "Claude ensures consistent application of best practices across the team"
4. **24/7 Availability**: "Get expert help anytime, without waiting for senior developers"
5. **Context Awareness**: "Claude understands your specific project context, not just generic advice"

---

## 🚀 Advanced Scenarios (If Time Permits)

### Security Review
```
@duo-agent Please review this authentication code for security vulnerabilities and suggest improvements.
```

### Performance Optimization
```
@duo-agent This query is running slowly. Can you help optimize it and suggest indexing strategies?
```

### Testing Strategy
```
@duo-agent What testing approach would you recommend for this payment processing module?
```

---

## 💡 Demo Tips

1. **Pre-create Issues**: Have 2-3 issues already created and processed before the demo
2. **Show Real-Time**: Use `npx wrangler tail` to show real-time processing
3. **Highlight Context**: Show how Claude remembers issue context in follow-up comments
4. **Error Recovery**: If something fails, show how the system handles errors gracefully
5. **Customization**: Mention how responses can be customized for team preferences

---

## 🎬 Demo Flow (10-15 minutes)

1. **Introduction** (2 min)
   - Problem statement: Developer productivity and knowledge sharing
   - Solution overview: AI-powered development assistant

2. **Live Demo** (8-10 min)
   - Scenario 1: Automatic issue processing
   - Scenario 2: Interactive assistance
   - Scenario 3: MR review
   - Quick examples of other scenarios

3. **Benefits & Q&A** (3-5 min)
   - ROI and productivity gains
   - Integration simplicity
   - Security and privacy
   - Customization options

---

## 🆘 Backup Plan

If live demo fails:
1. Have screenshots/recordings of each scenario
2. Show the wrangler logs from a previous successful run
3. Explain the architecture and integration points
4. Focus on use cases and benefits

Remember: The goal is to show value, not just technology!