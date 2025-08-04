import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Input validation schema
const RequestSchema = z.object({
  postcode: z.string().regex(/^[A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2}$/i, 'Invalid UK postcode'),
  limit: z.number().min(1).max(50).default(20),
  timeframe: z.enum(['24hours', '7days', '30days', '90days']).default('30days'),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
});

// Response caching - 5 minutes for property data
const CACHE_DURATION = 300;
const cache = new Map<string, { data: any; timestamp: number }>();

// Rate limiting - prevent API abuse
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = rateLimits.get(ip);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

function getCachedData(key: string) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any) {
  cache.set(key, { data, timestamp: Date.now() });
}

async function fetchPropertyData(params: z.infer<typeof RequestSchema>) {
  const apiKey = process.env.PROPERTYDATA_API_KEY;
  if (!apiKey) {
    throw new Error('PropertyData API key not configured');
  }

  // Build API request
  const requestBody = {
    postcode: params.postcode.replace(/\s+/g, '').toUpperCase(),
    limit: params.limit,
    period: params.timeframe,
    include: ['property_details', 'sale_details', 'images', 'market_trends'],
    filters: {
      ...(params.priceMin && { price_min: params.priceMin }),
      ...(params.priceMax && { price_max: params.priceMax }),
    }
  };

  const response = await fetch('https://api.propertydata.co.uk/sales', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'PropIndex/2.0',
    },
    body: JSON.stringify(requestBody),
    // Timeout after 10 seconds
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PropertyData API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function transformPropertyData(rawData: any): any[] {
  if (!rawData?.data) return [];

  return rawData.data.map((property: any, index: number) => ({
    id: property.id || `prop_${index}`,
    address: property.full_address || `${property.house_number || ''} ${property.street_name || 'Unknown Street'}`.trim(),
    postcode: property.postcode,
    soldPrice: property.sale_price || property.price || 0,
    originalPrice: property.original_asking_price || property.sale_price || 0,
    soldDate: property.sale_date || property.completion_date || new Date().toISOString(),
    image: property.images?.[0]?.url || property.main_image || null,
    timeOnMarket: property.days_on_market || null,
    propertyType: property.property_type || 'Unknown',
    bedrooms: property.bedrooms || null,
    bathrooms: property.bathrooms || null,
    agent: property.estate_agent?.name || 'Unknown Agent',
    priceChange: property.price_changes || 0,
    tenure: property.tenure || 'Unknown',
    epcRating: property.epc_rating || null,
    // Market analytics
    pricePerSqFt: property.price_per_sqft || null,
    marketTrend: property.market_trend || 'stable',
    daysOnMarket: property.days_on_market || null,
  }));
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.ip || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedData = RequestSchema.parse(body);

    // Check cache first
    const cacheKey = JSON.stringify(validatedData);
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch fresh data
    const rawData = await fetchPropertyData(validatedData);
    const transformedProperties = transformPropertyData(rawData);

    // Calculate market insights
    const insights = {
      averagePrice: transformedProperties.reduce((sum, p) => sum + p.soldPrice, 0) / transformedProperties.length || 0,
      medianPrice: transformedProperties.sort((a, b) => a.soldPrice - b.soldPrice)[Math.floor(transformedProperties.length / 2)]?.soldPrice || 0,
      averageTimeOnMarket: transformedProperties.reduce((sum, p) => sum + (p.timeOnMarket || 0), 0) / transformedProperties.length || 0,
      priceRange: {
        min: Math.min(...transformedProperties.map(p => p.soldPrice)),
        max: Math.max(...transformedProperties.map(p => p.soldPrice)),
      },
      propertyTypes: transformedProperties.reduce((acc, p) => {
        acc[p.propertyType] = (acc[p.propertyType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    const result = {
      success: true,
      properties: transformedProperties,
      insights,
      total: transformedProperties.length,
      postcode: validatedData.postcode,
      source: 'PropertyData.co.uk',
      timestamp: new Date().toISOString(),
      cached: false,
    };

    // Cache the result
    setCachedData(cacheKey, result);

    return NextResponse.json(result);

  } catch (error) {
    console.error('PropertyData API Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.name === 'TimeoutError') {
        return NextResponse.json(
          { error: 'Request timeout - PropertyData API is slow' },
          { status: 408 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to fetch property data', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'PropertyData API endpoint',
    version: '2.0',
    endpoints: {
      POST: '/api/properties - Fetch property data',
    },
    rateLimit: `${RATE_LIMIT} requests per minute`,
    cacheTime: `${CACHE_DURATION} seconds`,
  });
}
