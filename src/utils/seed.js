require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Contact = require('../models/Contact');
const MessageTemplate = require('../models/MessageTemplate');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/messagepro');
    console.log('Connected to MongoDB');

    // Create admin user
    const existing = await User.findOne({ email: 'admin@messagepro.com' });
    let adminUser;
    if (!existing) {
      adminUser = await User.create({
        name: 'Admin User',
        email: 'admin@messagepro.com',
        password: 'Admin@123',
        role: 'admin',
      });
      console.log('✅ Admin user created: admin@messagepro.com / Admin@123');
    } else {
      adminUser = existing;
      console.log('ℹ️ Admin user already exists');
    }

    // Seed contacts
    const contactCount = await Contact.countDocuments({ user: adminUser._id });
    if (contactCount === 0) {
      await Contact.insertMany([
        { user: adminUser._id, name: 'Adaeze Obi', company: 'TechNigeria Ltd', phone: '+2348012345678', whatsapp: '+2348012345678', instagram: '@adaeze_obi', facebook: 'adaeze.obi', tiktok: '@adaeze', tags: ['VIP'], segment: 'Customer', source: 'manual' },
        { user: adminUser._id, name: 'Emeka Chukwu', company: 'Lagos Supplies', phone: '+2348023456789', whatsapp: '+2348023456789', facebook: 'emeka.chukwu', tags: ['Lead'], segment: 'Prospect', source: 'manual' },
        { user: adminUser._id, name: 'Ngozi Eze', phone: '+2348034567890', whatsapp: '+2348034567890', tags: [], segment: 'Customer', source: 'manual' },
        { user: adminUser._id, name: 'Kemi Adesanya', company: 'Adesanya Group', phone: '+2348045678901', whatsapp: '+2348045678901', instagram: '@kemi_a', tags: ['VIP', 'Premium'], segment: 'Customer', source: 'manual' },
        { user: adminUser._id, name: 'Tunde Bakare', phone: '+2348056789012', tags: [], segment: 'Lead', source: 'manual' },
      ]);
      console.log('✅ Sample contacts created');
    }

    // Seed templates
    const templateCount = await MessageTemplate.countDocuments({ user: adminUser._id });
    if (templateCount === 0) {
      await MessageTemplate.insertMany([
        { user: adminUser._id, name: 'Welcome Message', content: 'Hi {{FirstName}}! 👋 Welcome to {{Company}}. We\'re excited to have you on board! Feel free to reach out anytime.', platform: 'whatsapp' },
        { user: adminUser._id, name: 'Promotional Offer', content: '🔥 Exclusive deal just for you, {{FirstName}}! Get 20% off your next order. Limited time only. Reply YES to claim!', platform: 'all' },
        { user: adminUser._id, name: 'Follow Up', content: 'Hi {{FirstName}}, just checking in! How can we help you today? We\'re always here to assist. 😊', platform: 'facebook' },
        { user: adminUser._id, name: 'Payment Reminder', content: 'Dear {{FirstName}}, this is a friendly reminder that your invoice is due. Please make payment at your earliest convenience. Thank you!', platform: 'whatsapp' },
      ]);
      console.log('✅ Sample templates created');
    }

    console.log('\n🚀 Seed completed successfully!');
    console.log('Login credentials: admin@messagepro.com / Admin@123');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seed();
