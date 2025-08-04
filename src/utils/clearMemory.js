import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config();

// Connect to MongoDB
async function connectDB() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI environment variable is required');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

// Memory Schema (simplified for this utility)
const MemorySchema = new mongoose.Schema({
  agentId: { type: String, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  source: { type: String, required: true },
  sourceUrl: { type: String },
  chunkIndex: { type: Number, required: true, default: 0 },
  contentHash: { type: String, required: true },
  contentVersion: { type: Number, required: true, default: 1 },
  chunkMetadata: { type: mongoose.Schema.Types.Mixed, required: true },
  sourceMetadata: { type: mongoose.Schema.Types.Mixed, required: false }
});

const Memory = mongoose.model('Memory', MemorySchema);

// Function to clear all Memory collection data
async function clearAllMemoryData() {
  try {
    console.log('🗑️ Starting Memory collection cleanup...');
    
    // Get count before deletion
    const countBefore = await Memory.countDocuments();
    console.log(`📊 Found ${countBefore} documents in Memory collection`);
    
    if (countBefore === 0) {
      console.log('✅ Memory collection is already empty');
      return;
    }
    
    // Delete all documents
    const result = await Memory.deleteMany({});
    
    console.log(`🗑️ Successfully deleted ${result.deletedCount} documents from Memory collection`);
    console.log('✅ Memory collection cleared successfully');
    
  } catch (error) {
    console.error('❌ Error clearing Memory collection:', error);
  }
}

// Function to clear data for a specific agent
async function clearAgentMemoryData(agentId) {
  try {
    console.log(`🗑️ Clearing data for agent ${agentId}...`);
    
    // Get count before deletion
    const countBefore = await Memory.countDocuments({ agentId });
    console.log(`📊 Found ${countBefore} documents for agent ${agentId}`);
    
    if (countBefore === 0) {
      console.log(`✅ No data found for agent ${agentId}`);
      return;
    }
    
    // Delete documents for this agent
    const result = await Memory.deleteMany({ agentId });
    
    console.log(`🗑️ Successfully deleted ${result.deletedCount} documents for agent ${agentId}`);
    console.log(`✅ Agent ${agentId} data cleared successfully`);
    
  } catch (error) {
    console.error('❌ Error clearing agent data:', error);
  }
}

// Function to list all agents in Memory collection
async function listMemoryAgents() {
  try {
    console.log('📊 Listing all agents in Memory collection...');
    
    const agents = await Memory.aggregate([
      {
        $group: {
          _id: '$agentId',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    if (agents.length === 0) {
      console.log('📊 Memory collection is empty');
      return;
    }
    
    console.log('📊 Agents in Memory collection:');
    agents.forEach((agent, index) => {
      console.log(`${index + 1}. Agent ID: ${agent._id} (${agent.count} chunks)`);
    });
    
  } catch (error) {
    console.error('❌ Error listing agents:', error);
  }
}

// Main function
async function main() {
  try {
    await connectDB();
    
    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    const agentId = args[1];
    
    switch (command) {
      case 'clear-all':
        await clearAllMemoryData();
        break;
      case 'clear-agent':
        if (!agentId) {
          console.log('❌ Please provide an agent ID: node clearMemory.js clear-agent <agentId>');
          break;
        }
        await clearAgentMemoryData(agentId);
        break;
      case 'list':
        await listMemoryAgents();
        break;
      default:
        console.log('📋 Usage:');
        console.log('  node clearMemory.js clear-all                    - Clear all Memory data');
        console.log('  node clearMemory.js clear-agent <agentId>        - Clear data for specific agent');
        console.log('  node clearMemory.js list                         - List all agents in Memory');
        break;
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed');
  }
}

// Run the script
main(); 