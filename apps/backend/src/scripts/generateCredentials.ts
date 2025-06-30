import { CredentialService } from '../services/credentialService';
import { EnvValidator } from '../utils/envValidator';
import * as crypto from 'crypto';

console.log('\n🔐 Secure Credential Generator\n');

const generateEncryptionKey = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

const generateJWTSecret = (length: number = 64): string => {
  return crypto.randomBytes(length).toString('base64');
};

const generateAPISecret = (length: number = 32): string => {
  return crypto.randomBytes(length).toString('hex');
};

const main = async () => {
  console.log('Generating secure credentials for your application...\n');

  try {
    // Check if we can validate environment variables
    const validation = EnvValidator.validate();
    
    if (validation.isValid) {
      console.log('✅ Environment variables are already configured.');
      console.log('If you need to generate new keys, add them to your .env file:\n');
    } else {
      console.log('⚠️  Some environment variables are missing. Generated keys below:\n');
    }

    // Generate keys
    const encryptionKey = generateEncryptionKey();
    const jwtSecret = generateJWTSecret();
    const apiSecret = generateAPISecret();

    console.log('Copy these values to your .env file:');
    console.log('=' .repeat(50));
    console.log(`ENCRYPTION_KEY=${encryptionKey}`);
    console.log(`JWT_SECRET=${jwtSecret}`);
    console.log(`API_SECRET_KEY=${apiSecret}`);
    console.log('=' .repeat(50));

    console.log('\n📋 Environment Variable Checklist:');
    console.log('Required for basic operation:');
    console.log('  ✓ NODE_ENV=development');
    console.log('  ✓ PORT=3001');
    console.log('  ✓ FRONTEND_URL=http://localhost:5173');
    console.log('  ✓ SUPABASE_URL=https://your-project.supabase.co');
    console.log('  ✓ SUPABASE_ANON_KEY=your-anon-key');
    console.log('  ✓ ENCRYPTION_KEY (generated above)');
    console.log('  ✓ JWT_SECRET (generated above)');
    console.log('  ✓ API_SECRET_KEY (generated above)');

    console.log('\nOptional for integrations:');
    console.log('  • SHOPIFY_CLIENT_ID');
    console.log('  • SHOPIFY_CLIENT_SECRET');
    console.log('  • TWILIO_ACCOUNT_SID');
    console.log('  • TWILIO_AUTH_TOKEN');
    console.log('  • ELEVENLABS_API_KEY');
    console.log('  • OPENAI_API_KEY');

    // If environment is configured, demonstrate API key generation
    if (validation.isValid) {
      console.log('\n🔑 Testing API Key Generation...');
      
      try {
        const credentialService = CredentialService.getInstance();
        const testApiKey = await credentialService.storeAPIKey(
          'test-key',
          ['credentials:read', 'credentials:write'],
          undefined // No expiration
        );
        
        console.log('✅ API Key generation test successful!');
        console.log(`   Key ID: ${testApiKey.id}`);
        console.log(`   API Key: ${testApiKey.apiKey}`);
        console.log('   Permissions: credentials:read, credentials:write');
        console.log('\n⚠️  Store this API key securely - it cannot be retrieved later!');
        
      } catch (error) {
        console.log('❌ API Key generation test failed:');
        console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        console.log('   Make sure your database is configured and accessible.');
      }
    }

  } catch (error) {
    console.error('❌ Error generating credentials:', error);
    console.log('\nPlease ensure your environment is properly configured.');
  }

  console.log('\n🚀 Next steps:');
  console.log('1. Copy the generated keys to your .env file');
  console.log('2. Configure your Supabase database connection');
  console.log('3. Run the server: npm run dev');
  console.log('4. Test the credential endpoints at /api/credentials/status');
  console.log('');
};

main().catch(console.error); 