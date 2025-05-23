// // File: controller/paymentController.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const User = require('../modules/userModule');
const { PLANS } = require('../config/plans');

// Configure Razorpay instance
const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Initiate Payment for Plans
exports.initiateRazorpayOrder = async (req, res) => {
    console.log('[Payment] Initiate request received:', {
        user: req.user.id,
        body: req.body
    });

    try {
        const { planId } = req.body;
        const user = await User.findById(req.user.id);
        
        // Handle free plan
        if (planId === 'starter') {
            console.log('[Payment] Processing free plan activation for user:', user.email);
            
            user.counselingPlan = 'starter';
            user.collegeListGenerationLimit += 3;
            user.paymentStatus = 'Completed';
            
            await user.save();
            console.log('[Payment] Free plan activated successfully:', {
                newLimit: user.collegeListGenerationLimit,
                plan: user.counselingPlan
            });

            return res.json({ 
                success: true, 
                plan: user.counselingPlan,
                collegeListGenerationLimit: user.collegeListGenerationLimit
            });
        }

        // Paid plan handling
        console.log('[Payment] Processing paid plan purchase:', {
            planId,
            user: user.email
        });

        const plan = PLANS[planId];
        const order = await razorpayInstance.orders.create({
            amount: plan.amount,
            currency: "INR",
            receipt: `plan_${user.id.slice(-6)}_${Date.now()}`,
            notes: {
                userId: user.id,
                purchaseType: 'plan',
                planId
            }
        });

        console.log('[Payment] Razorpay order created:', {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency
        });

        res.json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            key_id: process.env.RAZORPAY_KEY_ID,
            description: `${plan.name} Purchase`,
            prefill: { name: user.name, email: user.email, contact: user.phone }
        });

    } catch (error) {
        console.error('[Payment] Initiation error:', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Buy Additional Limit Endpoint
exports.buyAdditionalLimit = async (req, res) => {
    console.log('[Limit] Purchase request from user:', req.user.id);
    
    try {
        const user = await User.findById(req.user.id);
        const order = await razorpayInstance.orders.create({
            amount: 10000,
            currency: "INR",
            receipt: `limit_${user.id.slice(-6)}_${Date.now()}`,
            notes: {
                userId: user.id,
                purchaseType: 'additionalLimit'
            }
        });

        console.log('[Limit] Razorpay order created:', {
            orderId: order.id,
            amount: order.amount
        });

        res.json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            key_id: process.env.RAZORPAY_KEY_ID,
            description: "Additional College List Generation",
            prefill: { name: user.name, email: user.email, contact: user.phone }
        });

    } catch (error) {
        console.error('[Limit] Purchase error:', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
};

// Verify Payment
exports.verifyRazorpayPayment = async (req, res) => {
    console.log('[Verify] Payment verification request:', {
        body: req.body
    });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    
    try {
        // Signature verification
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            console.warn('[Verify] Invalid signature:', {
                received: razorpay_signature,
                expected: expectedSignature
            });
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        // Fetch order details
        const order = await razorpayInstance.orders.fetch(razorpay_order_id);
        console.log('[Verify] Order details:', order);

        // Get user and validate
        const user = await User.findById(order.notes.userId);
        if (!user) {
            console.error('[Verify] User not found:', order.notes.userId);
            return res.status(404).json({ success: false, message: "User not found" });
        }

        console.log('[Verify] Processing payment for user:', user.email);

        // Handle limit calculation
        const currentLimit = Number.isSafeInteger(user.collegeListGenerationLimit) 
            ? user.collegeListGenerationLimit 
            : 0;

        console.log('[Verify] Current limit:', currentLimit);

        if (order.notes.purchaseType === 'additionalLimit') {
            console.log('[Verify] Processing additional limit purchase');
            user.collegeListGenerationLimit = currentLimit + 1;
        } else {
            console.log('[Verify] Processing plan purchase:', order.notes.planId);
            const planDetails = PLANS[order.notes.planId];
            console.log('[Verify] Plan details:', planDetails);
            
            if (!planDetails) {
                throw new Error(`Invalid plan ID: ${order.notes.planId}`);
            }

            user.counselingPlan = order.notes.planId;
            user.collegeListGenerationLimit = currentLimit + Number(planDetails.collegeListGeneratorLimit);
            user.paymentStatus = 'Completed';
        }

        // Save user updates
        await user.save();
        console.log('[Verify] User updated successfully:', {
            newLimit: user.collegeListGenerationLimit,
            plan: user.counselingPlan
        });

        res.json({
            success: true,
            newLimit: user.collegeListGenerationLimit,
            plan: user.counselingPlan
        });

    } catch (error) {
        console.error('[Verify] Verification error:', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false, 
            message: error.message || "Internal server error" 
        });
    }
};

// Webhook Handler
exports.handleRazorpayWebhook = async (req, res) => {
    console.log('[Webhook] Received event:', {
        headers: req.headers,
        body: req.body
    });

    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);

    try {
        // Verify signature
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== signature) {
            console.warn('[Webhook] Invalid signature:', {
                received: signature,
                expected: expectedSignature
            });
            return res.status(400).send('Invalid signature');
        }

        console.log('[Webhook] Signature verified successfully');

        // Process events
        const event = req.body.event;
        if (event === 'payment.captured') {
            console.log('[Webhook] Processing payment captured event');
            const payment = req.body.payload.payment.entity;
            const order = await razorpayInstance.orders.fetch(payment.order_id);
            const user = await User.findById(order.notes.userId);

            if (!user) {
                console.error('[Webhook] User not found:', order.notes.userId);
                return res.status(404).send('User not found');
            }

            // Handle limit updates
            const currentLimit = Number.isSafeInteger(user.collegeListGenerationLimit)
                ? user.collegeListGenerationLimit
                : 0;

            if (order.notes.purchaseType === 'additionalLimit') {
                console.log('[Webhook] Adding additional limit');
                user.collegeListGenerationLimit = currentLimit + 1;
            } else {
                console.log('[Webhook] Processing plan purchase');
                user.counselingPlan = order.notes.planId;
                user.collegeListGenerationLimit = currentLimit + PLANS[order.notes.planId].collegeListLimit;
                user.paymentStatus = 'Completed';
            }

            await user.save();
            console.log('[Webhook] User updated successfully:', {
                userId: user.id,
                newLimit: user.collegeListGenerationLimit
            });
        }

        res.status(200).json({ status: 'ok' });

    } catch (error) {
        console.error('[Webhook] Processing error:', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).send('Server error');
    }
};