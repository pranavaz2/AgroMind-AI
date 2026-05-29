const { prisma, connectDatabase, disconnectDatabase } = require('../config/db');

async function testScanPersistence() {
  console.log('=== AgroMind AI Database Persistence Test ===');
  
  try {
    await connectDatabase();
    
    // Check if we have at least one user to associate the scan with
    const testUser = await prisma.user.findFirst();
    if (!testUser) {
      console.error('✗ No test user found in the database. Please register a user first.');
      await disconnectDatabase();
      return;
    }
    
    console.log(`Using test user: ${testUser.fullName} (ID: ${testUser.id})`);
    
    // Dummy AI result resembling the normalized output of aiService.js
    const mockAiResult = {
      diseaseName: 'Tomato - Late blight',
      displayName: 'Tomato - Late Blight',
      confidence: 0.9452,
      severity: 'needs_attention',
      treatment: 'Apply late blight fungicides. Remove infected plants.',
      prevention: 'Avoid overhead watering. Maintain crop spacing.',
      predictionTimeMs: 45,
      topPredictions: [
        { class: 'Tomato - Late blight', confidence: 0.9452 },
        { class: 'Tomato - healthy', confidence: 0.0548 }
      ],
      modelVersion: 'mobilenet_v2_v1',
      predictionSource: 'tensorflow_fastapi',
      predictionTimestamp: new Date().toISOString()
    };
    
    const mockImageUrl = 'https://res.cloudinary.com/deoyciadj/image/upload/v1780037665/agromind/verification-tests/test-image.jpg';
    
    console.log('Creating test CropScan record in the database...');
    const scan = await prisma.cropScan.create({
      data: {
        cropName: mockAiResult.diseaseName,
        imageUrl: mockImageUrl,
        aiSummary: JSON.stringify(mockAiResult),
        status: 'COMPLETED',
        confidence: mockAiResult.confidence,
        userId: testUser.id,
        farmId: null
      }
    });
    
    console.log('✓ CropScan record created successfully.');
    console.log('  ID:', scan.id);
    console.log('  Crop Name:', scan.cropName);
    console.log('  Image URL:', scan.imageUrl);
    console.log('  Confidence:', Number(scan.confidence));
    
    // Retrieve the scan and verify it
    console.log('Retrieving scan from database to verify values...');
    const retrievedScan = await prisma.cropScan.findUnique({
      where: { id: scan.id }
    });
    
    if (!retrievedScan) {
      throw new Error('Could not retrieve the newly created scan.');
    }
    
    const retrievedAiResult = JSON.parse(retrievedScan.aiSummary);
    
    console.log('--- Verification Checklist ---');
    console.log(retrievedScan.cropName === mockAiResult.diseaseName ? '✓ Crop Name matches' : '✗ Crop Name mismatch');
    console.log(retrievedScan.imageUrl === mockImageUrl ? '✓ Image URL matches' : '✗ Image URL mismatch');
    console.log(Number(retrievedScan.confidence) === mockAiResult.confidence ? '✓ Confidence matches' : '✗ Confidence mismatch');
    console.log(retrievedAiResult.displayName === mockAiResult.displayName ? '✓ Display Name in aiSummary matches' : '✗ Display Name in aiSummary mismatch');
    console.log(retrievedScan.status === 'COMPLETED' ? '✓ Scan status is COMPLETED' : '✗ Scan status mismatch');
    
    // Clean up test scan
    console.log('Cleaning up test scan from database...');
    await prisma.cropScan.delete({
      where: { id: scan.id }
    });
    console.log('✓ Database cleaned up successfully.');
    
  } catch (error) {
    console.error('✗ Database persistence test failed:', error.message);
  } finally {
    try {
      await disconnectDatabase();
      console.log('Gracefully disconnected from database.');
    } catch (e) {}
  }
  
  console.log('=== Database Persistence Test Complete ===');
}

testScanPersistence();
