-- Products and Orders Tables for Voice-Enabled Ecommerce Customer Service Platform

-- Enums are now in 00_enums_and_types.sql

-- Products Table - Synced product catalog from ecommerce platforms
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- External platform identifiers
    external_id VARCHAR(255) NOT NULL, -- Product ID from platform (Shopify, WooCommerce, etc.)
    external_variant_id VARCHAR(255), -- Variant ID if applicable
    
    -- Basic product information
    title VARCHAR(500) NOT NULL,
    description TEXT,
    handle VARCHAR(255), -- URL handle/slug
    
    -- Product categorization
    product_type VARCHAR(255),
    vendor VARCHAR(255),
    tags TEXT[], -- Array of tags
    
    -- Pricing information
    price DECIMAL(10,2) NOT NULL,
    compare_at_price DECIMAL(10,2),
    cost_per_item DECIMAL(10,2),
    currency_code VARCHAR(10) DEFAULT 'USD',
    
    -- Inventory management
    sku VARCHAR(255),
    barcode VARCHAR(255),
    inventory_quantity INTEGER DEFAULT 0,
    inventory_tracked BOOLEAN DEFAULT false,
    availability product_availability DEFAULT 'in_stock',
    
    -- Physical properties
    weight DECIMAL(8,3),
    weight_unit VARCHAR(10) DEFAULT 'kg',
    
    -- SEO and metadata
    seo_title VARCHAR(255),
    seo_description TEXT,
    
    -- Platform-specific data (JSON for flexibility)
    platform_data JSONB,
    
    -- Status and sync
    status product_status DEFAULT 'active',
    is_published BOOLEAN DEFAULT true,
    published_at TIMESTAMPTZ,
    
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash VARCHAR(64), -- For detecting changes
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(store_id, external_id),
    CONSTRAINT positive_price CHECK (price >= 0),
    CONSTRAINT positive_inventory CHECK (inventory_quantity >= 0),
    CONSTRAINT valid_url CHECK (url ~* '^https?://.*')
);

-- Product Images Table
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Image details
    external_id VARCHAR(255),
    url TEXT NOT NULL,
    alt_text VARCHAR(255),
    position INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_url CHECK (url ~* '^https?://.*')
);

-- Orders Table - Customer orders from ecommerce platforms
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    
    -- External platform identifiers
    external_id VARCHAR(255) NOT NULL, -- Order ID from platform
    order_number VARCHAR(255), -- Human-readable order number
    
    -- Customer information
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    customer_first_name VARCHAR(255),
    customer_last_name VARCHAR(255),
    customer_external_id VARCHAR(255), -- Customer ID from platform
    
    -- Order totals
    subtotal_price DECIMAL(10,2) NOT NULL,
    total_tax DECIMAL(10,2) DEFAULT 0,
    total_shipping DECIMAL(10,2) DEFAULT 0,
    total_discounts DECIMAL(10,2) DEFAULT 0,
    total_price DECIMAL(10,2) NOT NULL,
    currency_code VARCHAR(10) DEFAULT 'USD',
    
    -- Order status tracking
    status order_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    fulfillment_status fulfillment_status DEFAULT 'unfulfilled',
    
    -- Shipping information
    shipping_address JSONB,
    billing_address JSONB,
    shipping_method VARCHAR(255),
    tracking_number VARCHAR(255),
    tracking_url TEXT,
    
    -- Important dates
    order_date TIMESTAMPTZ NOT NULL,
    shipped_date TIMESTAMPTZ,
    delivered_date TIMESTAMPTZ,
    cancelled_date TIMESTAMPTZ,
    
    -- Platform-specific data
    platform_data JSONB,
    
    -- Notes and communication
    customer_notes TEXT,
    internal_notes TEXT,
    
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash VARCHAR(64),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(store_id, external_id),
    CONSTRAINT positive_totals CHECK (subtotal_price >= 0 AND total_price >= 0),
    CONSTRAINT valid_customer_email CHECK (customer_email IS NULL OR customer_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Order Line Items Table - Individual products within orders
CREATE TABLE order_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    
    -- External identifiers
    external_id VARCHAR(255),
    external_product_id VARCHAR(255),
    external_variant_id VARCHAR(255),
    
    -- Product details (snapshot at time of order)
    title VARCHAR(500) NOT NULL,
    variant_title VARCHAR(255),
    sku VARCHAR(255),
    
    -- Pricing and quantity
    price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    
    -- Product properties at time of purchase
    properties JSONB, -- Custom properties/options
    
    -- Fulfillment tracking
    fulfillment_status fulfillment_status DEFAULT 'unfulfilled',
    fulfilled_quantity INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT positive_price_quantity CHECK (price >= 0 AND quantity > 0),
    CONSTRAINT positive_fulfilled_quantity CHECK (fulfilled_quantity >= 0 AND fulfilled_quantity <= quantity)
);

-- Customers Table - Customer information for better service
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    
    -- External platform identifiers
    external_id VARCHAR(255) NOT NULL, -- Customer ID from platform
    
    -- Customer information
    email VARCHAR(255),
    phone VARCHAR(20),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    
    -- Customer status and preferences
    accepts_marketing BOOLEAN DEFAULT false,
    preferred_language VARCHAR(10) DEFAULT 'en',
    
    -- Customer analytics
    total_spent DECIMAL(10,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    lifetime_value DECIMAL(10,2) DEFAULT 0,
    
    -- Customer service history
    last_order_date TIMESTAMPTZ,
    last_contact_date TIMESTAMPTZ,
    
    -- Tags and categorization
    tags TEXT[], -- Customer tags
    
    -- Platform-specific data
    platform_data JSONB,
    
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_hash VARCHAR(64),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(store_id, external_id),
    CONSTRAINT valid_customer_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_customer_phone CHECK (phone IS NULL OR phone ~* '^\+[1-9]\d{1,14}$'),
    CONSTRAINT positive_totals CHECK (total_spent >= 0 AND total_orders >= 0 AND lifetime_value >= 0)
);

-- Indexes for performance
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_external_id ON products(external_id);
CREATE INDEX idx_products_sku ON products(sku) WHERE sku IS NOT NULL;
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_availability ON products(availability);
CREATE INDEX idx_products_last_synced ON products(last_synced_at);
CREATE INDEX idx_products_tags ON products USING GIN(tags);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_position ON product_images(position);

CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_external_id ON orders(external_id);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_last_synced ON orders(last_synced_at);

CREATE INDEX idx_order_line_items_order_id ON order_line_items(order_id);
CREATE INDEX idx_order_line_items_product_id ON order_line_items(product_id);
CREATE INDEX idx_order_line_items_external_product_id ON order_line_items(external_product_id);
CREATE INDEX idx_order_line_items_sku ON order_line_items(sku) WHERE sku IS NOT NULL;

CREATE INDEX idx_customers_store_id ON customers(store_id);
CREATE INDEX idx_customers_external_id ON customers(external_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_customers_last_order_date ON customers(last_order_date);
CREATE INDEX idx_customers_tags ON customers USING GIN(tags);

-- Add updated_at triggers for new tables
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_line_items_updated_at 
    BEFORE UPDATE ON order_line_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customers_updated_at 
    BEFORE UPDATE ON customers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security for multi-tenancy
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Function to update customer lifetime value when orders change
CREATE OR REPLACE FUNCTION update_customer_lifetime_value()
RETURNS TRIGGER AS $$
BEGIN
    -- Update customer statistics when orders change
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE customers 
        SET 
            total_spent = COALESCE((
                SELECT SUM(total_price) 
                FROM orders 
                WHERE customer_id = NEW.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0),
            total_orders = COALESCE((
                SELECT COUNT(*) 
                FROM orders 
                WHERE customer_id = NEW.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0),
            last_order_date = (
                SELECT MAX(order_date) 
                FROM orders 
                WHERE customer_id = NEW.customer_id
            ),
            lifetime_value = COALESCE((
                SELECT SUM(total_price) 
                FROM orders 
                WHERE customer_id = NEW.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0)
        WHERE id = NEW.customer_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE customers 
        SET 
            total_spent = COALESCE((
                SELECT SUM(total_price) 
                FROM orders 
                WHERE customer_id = OLD.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0),
            total_orders = COALESCE((
                SELECT COUNT(*) 
                FROM orders 
                WHERE customer_id = OLD.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0),
            last_order_date = (
                SELECT MAX(order_date) 
                FROM orders 
                WHERE customer_id = OLD.customer_id
            ),
            lifetime_value = COALESCE((
                SELECT SUM(total_price) 
                FROM orders 
                WHERE customer_id = OLD.customer_id 
                AND status NOT IN ('cancelled', 'refunded')
            ), 0)
        WHERE id = OLD.customer_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger to update customer lifetime value
CREATE TRIGGER update_customer_ltv_trigger
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_customer_lifetime_value(); 