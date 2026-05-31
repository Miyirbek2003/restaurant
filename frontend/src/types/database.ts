export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'SUPER_ADMIN' | 'MANAGER' | 'WAITER' | 'KITCHEN';
export type StaffRole = 'WAITER' | 'KITCHEN';
export type OrderStatus = 'DRAFT' | 'NEW' | 'PREPARING' | 'READY' | 'SERVED' | 'PAID' | 'CANCELLED';
export type TableStatus = 'FREE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          logo_url: string | null;
          status: string;
          subscription_plan: string;
          currency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database['public']['Tables']['restaurants']['Row']> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database['public']['Tables']['restaurants']['Row']>;
      };
      profiles: {
        Row: {
          id: string;
          restaurant_id: string | null;
          email: string;
          name: string;
          phone: string | null;
          role: UserRole;
          status: string;
          salary: number | null;
          hire_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      restaurant_staff: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          role: StaffRole;
          phone: string | null;
          email: string | null;
          status: string;
          hire_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['restaurant_staff']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['restaurant_staff']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          description: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          restaurant_id: string;
          category_id: string;
          name: string;
          sku: string | null;
          barcode: string | null;
          description: string | null;
          price: number;
          cost_price: number;
          tax_rate: number;
          image_url: string | null;
          is_active: boolean;
          stock_quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      tables: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          capacity: number;
          floor: string | null;
          status: TableStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tables']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tables']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          restaurant_id: string;
          table_id: string | null;
          staff_id: string | null;
          customer_id: string | null;
          order_number: number;
          status: OrderStatus;
          notes: string | null;
          subtotal: number;
          discount_amount: number;
          tax_amount: number;
          total: number;
          sent_to_kitchen_at: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      order_items: {
        Row: {
          id: string;
          restaurant_id: string;
          order_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          tax_rate: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          birthday: string | null;
          notes: string | null;
          loyalty_points: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at' | 'loyalty_points'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      inventory_items: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          unit: string;
          quantity: number;
          minimum_quantity: number;
          cost_per_unit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory_items']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['inventory_items']['Insert']>;
      };
      suppliers: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          notes: string | null;
          outstanding_balance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at' | 'outstanding_balance'>;
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>;
      };
      expenses: {
        Row: {
          id: string;
          restaurant_id: string;
          category: string;
          title: string;
          amount: number;
          date: string;
          receipt_url: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>;
      };
      discounts: {
        Row: {
          id: string;
          restaurant_id: string;
          name: string;
          type: string;
          value: number;
          coupon_code: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['discounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['discounts']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          restaurant_id: string;
          order_id: string;
          amount: number;
          method: string;
          status: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
    };
    Functions: {
      next_order_number: { Args: { p_restaurant_id: string }; Returns: number };
      recalculate_order_totals: { Args: { p_order_id: string }; Returns: void };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'] & {
  restaurants?: Database['public']['Tables']['restaurants']['Row'] | null;
};
export type Product = Database['public']['Tables']['products']['Row'] & {
  categories?: { name: string } | null;
};
export type Order = Database['public']['Tables']['orders']['Row'] & {
  tables?: { name: string } | null;
  profiles?: { name: string } | null;
  order_items?: Array<
    Database['public']['Tables']['order_items']['Row'] & {
      products?: { name: string } | null;
    }
  >;
};
