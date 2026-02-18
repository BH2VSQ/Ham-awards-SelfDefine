console.log('Starting server...');
try {
  require('./server.js');
} catch (error) {
  console.error('Error starting server:', error);
  console.error('Stack trace:', error.stack);
}