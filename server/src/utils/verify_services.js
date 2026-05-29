const { prisma, connectDatabase, disconnectDatabase } = require('../config/db');
const { checkAiServiceHealth, analyzeLeafImage } = require('../services/aiService');
const { uploadImage, deleteImage } = require('../services/uploadService');
const fs = require('fs');

async function verifyAll() {
  console.log('=== AgroMind AI E2E Backend Verification ===');
  
  // 1. Verify PostgreSQL Database
  console.log('\n--- 1. Database Connection ---');
  try {
    await connectDatabase();
    console.log('✓ Successfully connected to PostgreSQL via Prisma.');
    
    // Check if we can query the users table
    const usersCount = await prisma.user.count();
    console.log(`✓ Queried users table successfully. Count: ${usersCount}`);
    
    // Check cropScan table structure
    const scanCount = await prisma.cropScan.count();
    console.log(`✓ Queried cropScan table successfully. Count: ${scanCount}`);
  } catch (error) {
    console.error('✗ Database verification failed:', error.message);
  }

  // 2. Verify Cloudinary Upload
  console.log('\n--- 2. Cloudinary Integration ---');
  let uploadedPublicId = null;
  try {
    // 1x1 transparent GIF buffer
    const dummyImageBuffer = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    
    console.log('Uploading 1x1 dummy image to Cloudinary...');
    const uploadResult = await uploadImage(dummyImageBuffer, {
      folder: 'verification-tests',
      userId: '00000000-0000-0000-0000-000000000000'
    });
    
    console.log('✓ Cloudinary upload succeeded.');
    console.log('  URL:', uploadResult.url);
    console.log('  Public ID:', uploadResult.publicId);
    uploadedPublicId = uploadResult.publicId;
    
    // Cleanup/Delete
    console.log('Cleaning up/deleting verification image from Cloudinary...');
    await deleteImage(uploadedPublicId);
    console.log('✓ Cloudinary deletion succeeded.');
  } catch (error) {
    console.error('✗ Cloudinary verification failed:', error.message);
  }

  // 3. Verify AI service health and mock prediction
  console.log('\n--- 3. FastAPI AI Service Integration ---');
  try {
    console.log('Checking AI service health...');
    const isHealthy = await checkAiServiceHealth();
    console.log(`✓ AI service health check returned: ${isHealthy ? 'ONLINE' : 'OFFLINE'}`);
    
    if (isHealthy) {
      console.log('Testing prediction with 1x1 dummy image buffer...');
      const dummyImageBuffer = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
      );
      
      const prediction = await analyzeLeafImage(dummyImageBuffer, 'image/jpeg');
      console.log('✓ Prediction succeeded! Normalized response output:');
      console.log(JSON.stringify(prediction, null, 2));
    } else {
      console.warn('! AI Service is offline. Skipping prediction test.');
    }
  } catch (error) {
    console.error('✗ AI Service verification failed:', error.message);
  }

  // Shutdown DB connection pool
  try {
    await disconnectDatabase();
    console.log('\n✓ Gracefully disconnected from PostgreSQL.');
  } catch (error) {
    // Ignore
  }
  
  console.log('\n=== Verification Run Complete ===');
}

verifyAll();
