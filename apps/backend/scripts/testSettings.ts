import { DatabaseService } from '../src/services/database';
import { CredentialService } from '../src/services/credentialService';

async function testSettings() {
  try {
    const dbService = DatabaseService.getInstance();
    const credentialService = CredentialService.getInstance();

    console.log('🔧 Testing Settings Functionality...\n');

    // Test database connection
    console.log('1. Testing database connection...');
    const isConnected = await dbService.testConnection();
    console.log(`   Database: ${isConnected ? '✅ Connected' : '❌ Failed'}\n`);

    if (!isConnected) {
      console.log('❌ Cannot proceed without database connection');
      return;
    }

    // Test credential service
    console.log('2. Testing credential service...');
    try {
      const testData = 'test-api-key-12345';
      const encrypted = credentialService.encrypt(testData);
      const decrypted = credentialService.decrypt(encrypted);
      
      if (testData === decrypted) {
        console.log('   Encryption/Decryption: ✅ Working');
      } else {
        console.log('   Encryption/Decryption: ❌ Failed');
      }
    } catch (error) {
      console.log('   Encryption/Decryption: ❌ Error -', error);
    }

    // Test table creation (skip for Supabase - assume table exists or will be created via SQL editor)
    console.log('\n3. Checking user_settings table...');
    try {
      const { data, error } = await dbService.getClient()
        .from('user_settings')
        .select('count')
        .limit(1);
      
      if (!error) {
        console.log('   Table check: ✅ Table exists and accessible');
      } else {
        console.log('   Table check: ⚠️  Table may not exist -', error.message);
        console.log('   Please create the table using the SQL in backend/database/05_user_settings.sql');
      }
    } catch (error) {
      console.log('   Table check: ❌ Error -', error);
    }

    // Test insert/update operations
    console.log('\n4. Testing CRUD operations...');
    const testUserId = 'test-user-' + Date.now();
    
    try {
      // Insert test settings
      const testSettings = {
        user_id: testUserId,
        twilio_phone: '+1234567890',
        twilio_account_sid: credentialService.encrypt('test-account-sid'),
        openai_api_key: credentialService.encrypt('test-openai-key'),
        elevenlabs_voice_id: 'test-voice-id',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await dbService.getClient()
        .from('user_settings')
        .insert([testSettings]);

      if (insertError) {
        throw insertError;
      }

      console.log('   Insert: ✅ Success');

      // Test retrieval
      const { data: retrieved, error: selectError } = await dbService.getClient()
        .from('user_settings')
        .select('*')
        .eq('user_id', testUserId)
        .single();

      if (selectError) {
        throw selectError;
      }

      if (retrieved) {
        console.log('   Retrieval: ✅ Success');
        
        // Test decryption
        const decryptedSid = credentialService.decrypt(retrieved.twilio_account_sid);
        const decryptedKey = credentialService.decrypt(retrieved.openai_api_key);
        
        if (decryptedSid === 'test-account-sid' && decryptedKey === 'test-openai-key') {
          console.log('   Decryption: ✅ Success');
        } else {
          console.log('   Decryption: ❌ Failed');
        }
      } else {
        console.log('   Retrieval: ❌ No data found');
      }

      // Cleanup
      const { error: deleteError } = await dbService.getClient()
        .from('user_settings')
        .delete()
        .eq('user_id', testUserId);
      
      if (deleteError) {
        console.log('   Cleanup: ⚠️  Warning -', deleteError.message);
      } else {
        console.log('   Cleanup: ✅ Complete');
      }

    } catch (error) {
      console.log('   CRUD operations: ❌ Error -', error);
    }

    console.log('\n🎉 Settings functionality test complete!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testSettings().catch(console.error); 