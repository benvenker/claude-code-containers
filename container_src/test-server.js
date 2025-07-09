// Quick test to see if the server starts
console.log('Testing server startup...');
console.log('PORT env:', process.env.PORT);
console.log('Parsed PORT:', process.env.PORT ? parseInt(process.env.PORT, 10) : 8080);

// Try to start the server
try {
  await import('./dist/main.js');
  console.log('Server module loaded successfully');
} catch (error) {
  console.error('Error loading server:', error.message);
  console.error(error.stack);
}

// Give it a moment to see if it crashes
setTimeout(() => {
  console.log('Server still running after 2 seconds');
}, 2000);