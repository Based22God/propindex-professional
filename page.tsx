"use client"

import { BarChart3, PoundSterling, User, ChevronDown, MapPin, TrendingUp, TrendingDown, Clock, Filter, Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TypingInput } from "@/components/typing-input"
import { ThemeToggle } from "@/components/theme-toggle"
import { Sidebar } from "@/components/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useState, useEffect, useRef } from "react"

// Real PropertyData API integration
const fetchSoldProperties = async (postcode: string, limit: number = 20) => {
  try {
    const response = await fetch('/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        postcode: postcode,
        limit: limit,
        timeframe: '90days'
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch properties');
    }

    const data = await response.json();
    return data.properties || [];
  } catch (error) {
    console.error('Error fetching properties:', error);
    // Fallback to mock data if API fails
    return generateMockSoldProperties();
  }
};

// Fallback mock data (for when API is down)
const generateMockSoldProperties = () => {
  const addresses = [
    "123 Oak Street, SW1A 1AA",
    "45 Victoria Road, W1K 3TD",
    "78 Mill Lane, E1 6AN",
    "12 Church Close, N1 9GU",
    "34 High Street, SE1 9SG",
    "56 Park Avenue, WC1H 9JP",
    "89 Green Road, EC1A 4HD",
    "23 Kings Way, SW7 2AZ",
    "67 Queens Gate, NW1 4RY",
    "91 Baker Street, W1U 6QW"
  ];

  return Array.from({ length: 20 }, (_, i) => ({
    id: i + 1,
    address: addresses[Math.floor(Math.random() * addresses.length)],
    postcode: addresses[Math.floor(Math.random() * addresses.length)].split(', ')[1],
    soldPrice: Math.floor(Math.random() * 800000) + 200000,
    originalPrice: Math.floor(Math.random() * 900000) + 250000,
    soldDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    image: `https://images.unsplash.com/photo-1560184318-d4c4b2e0e5d4?w=300&h=200&fit=crop&auto=format`,
    timeOnMarket: Math.floor(Math.random() * 90) + 7,
    propertyType: 'House',
    bedrooms: Math.floor(Math.random() * 5) + 1,
  }));
};

// Enhanced Sold Properties Ticker Component
function SoldPropertiesTicker({ userPostcode = "SW1A", onPropertyClick }: { userPostcode?: string, onPropertyClick?: (property: any) => void }) {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [priceFilter, setPriceFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('7days');

  // Load real PropertyData on component mount and when postcode changes
  useEffect(() => {
    const loadProperties = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const realProperties = await fetchSoldProperties(userPostcode);
        setProperties(realProperties);
      } catch (err) {
        setError('Failed to load property data');
        // Use mock data as fallback
        setProperties(generateMockSoldProperties());
      } finally {
        setLoading(false);
      }
    };

    loadProperties();
  }, [userPostcode]);

  // Update properties every 5 minutes with fresh data
  useEffect(() => {
    const updateInterval = setInterval(async () => {
      if (!isPaused) {
        try {
          const freshProperties = await fetchSoldProperties(userPostcode);
          setProperties(freshProperties);
        } catch (err) {
          console.error('Failed to update properties:', err);
        }
      }
    }, 300000); // 5 minutes

    return () => clearInterval(updateInterval);
  }, [userPostcode, isPaused]);

  const filteredProperties = properties.filter(property => {
    const daysSinceSold = Math.floor((Date.now() - new Date(property.soldDate).getTime()) / (1000 * 60 * 60 * 24));
    
    let passesTimeFilter = true;
    switch (timeFilter) {
      case '24hours': passesTimeFilter = daysSinceSold <= 1; break;
      case '7days': passesTimeFilter = daysSinceSold <= 7; break;
      case '30days': passesTimeFilter = daysSinceSold <= 30; break;
    }

    let passesPriceFilter = true;
    switch (priceFilter) {
      case 'under500k': passesPriceFilter = property.soldPrice < 500000; break;
      case '500k-1m': passesPriceFilter = property.soldPrice >= 500000 && property.soldPrice < 1000000; break;
      case 'over1m': passesPriceFilter = property.soldPrice >= 1000000; break;
    }

    return passesTimeFilter && passesPriceFilter;
  });

  const formatPrice = (price: number) => {
    if (price >= 1000000) return `£${(price / 1000000).toFixed(1)}M`;
    if (price >= 1000) return `£${(price / 1000).toFixed(0)}K`;
    return `£${price.toLocaleString()}`;
  };

  const getPriceChange = (soldPrice: number, originalPrice: number) => {
    const change = soldPrice - originalPrice;
    const changePercent = ((change / originalPrice) * 100).toFixed(1);
    
    if (change > 0) {
      return (
        <span className="flex items-center text-green-500 text-xs">
          <TrendingUp className="h-3 w-3 mr-1" />+{changePercent}%
        </span>
      );
    } else if (change < 0) {
      return (
        <span className="flex items-center text-red-500 text-xs">
          <TrendingDown className="h-3 w-3 mr-1" />{changePercent}%
        </span>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="w-full bg-black border-t border-zinc-800 h-24 flex items-center justify-center">
        <div className="text-white text-sm">Loading recent sales...</div>
      </div>
    );
  }

  if (error && filteredProperties.length === 0) {
    return (
      <div className="w-full bg-black border-t border-zinc-800 h-24 flex items-center justify-center">
        <div className="text-red-400 text-sm">Unable to load property data. Using sample data.</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-black border-t border-zinc-800">
      <div className="flex items-center justify-between px-4 py-2 bg-black border-b border-zinc-800">
        <div className="flex items-center space-x-4">
          <h3 className="text-sm font-semibold text-white flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
            Recent Sales - {userPostcode} Area
            {loading && <span className="ml-2 text-xs text-zinc-400">(Updating...)</span>}
          </h3>
          <span className="text-xs text-zinc-400">
            {filteredProperties.length} properties
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <Filter className="h-3 w-3 mr-1" />
                Time: {timeFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32 bg-zinc-900 border-zinc-700">
              <DropdownMenuItem onClick={() => setTimeFilter('24hours')} className="text-xs text-zinc-400 hover:text-white hover:bg-zinc-800">Last 24h</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeFilter('7days')} className="text-xs text-zinc-400 hover:text-white hover:bg-zinc-800">Last 7 days</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTimeFilter('30days')} className="text-xs text-zinc-400 hover:text-white hover:bg-zinc-800">Last 30 days</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <Filter className="h-3 w-3 mr-1" />
                Price: {priceFilter === 'all' ? 'All' : priceFilter}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32 bg-zinc-900 border-zinc-700">
              <DropdownMenuItem onClick={() => setPriceFilter('all')} className="text-xs text-zinc-400 hover:text-white hover:bg-zinc-800">All Prices</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriceFilter('under500k')} className="text-xs text-zinc-400 hover:text-white hover:bg-zinc-800">Under £500K</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriceFilter('500k-1m')} className="text-xs text-zinc-400 hover:text-white hover:bg-zinc-800">£500K - £1M</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriceFilter('over1m')} className="text-xs text-zinc-400 hover:text-white hover:bg-zinc-800">Over £1M</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="text-xs h-7 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden h-24 bg-black w-full">
        <div
          className="flex space-x-4 py-2 bg-black absolute"
          style={{
            width: `${filteredProperties.length * 280 * 2}px`,
            animation: isPaused ? 'none' : `ticker-scroll ${Math.max(filteredProperties.length * 8, 60)}s linear infinite`,
            transform: 'translateX(0%)',
            left: 0,
            top: 0
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* First set of properties */}
          {filteredProperties.map((property) => (
            <PropertyCard 
              key={property.id} 
              property={property} 
              onClick={() => onPropertyClick && onPropertyClick(property)}
              formatPrice={formatPrice}
              getPriceChange={getPriceChange}
            />
          ))}
          
          {/* Duplicate set for seamless loop */}
          {filteredProperties.map((property) => (
            <PropertyCard 
              key={`${property.id}-duplicate`} 
              property={property} 
              onClick={() => onPropertyClick && onPropertyClick(property)}
              formatPrice={formatPrice}
              getPriceChange={getPriceChange}
            />
          ))}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes ticker-scroll {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }
        `
      }} />
    </div>
  );
}

// Separate Property Card Component for cleaner code
function PropertyCard({ property, onClick, formatPrice, getPriceChange }: any) {
  return (
    <div
      onClick={onClick}
      className="flex-shrink-0 w-72 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:scale-[1.02] hover:border-blue-500"
    >
      <div className="flex space-x-3">
        <div className="w-16 h-16 bg-zinc-800 rounded-md overflow-hidden flex-shrink-0">
          <img
            src={property.image || `https://images.unsplash.com/photo-1560184318-d4c4b2e0e5d4?w=300&h=200&fit=crop&auto=format`}
            alt="Property"
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = `data:image/svg+xml,${encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="#27272a"/><path d="M20 20h24v24H20z" fill="#52525b"/></svg>'
              )}`;
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">
                {property.address.split(',')[0]}
              </p>
              <p className="text-xs text-zinc-400 flex items-center mt-0.5">
                <MapPin className="h-3 w-3 mr-1" />
                {property.postcode}
              </p>
            </div>
            <span className="text-xs bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2">
              SOLD
            </span>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-white">
                {formatPrice(property.soldPrice)}
              </span>
              {property.originalPrice && getPriceChange(property.soldPrice, property.originalPrice)}
            </div>
            
            <div className="flex items-center justify-between mt-1 text-xs text-zinc-400">
              <span className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {property.timeOnMarket || Math.floor(Math.random() * 90) + 7}d on market
              </span>
              <span>
                {Math.floor((Date.now() - new Date(property.soldDate).getTime()) / (1000 * 60 * 60 * 24))}d ago
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Home Component
export default function Home() {
  const [userPostcode, setUserPostcode] = useState("SW1A");

  const handleSearchSelect = (query: string) => {
    console.log("Selected search:", query);
    const postcodeMatch = query.match(/^[A-Z]{1,2}\d{1,2}/i);
    if (postcodeMatch) {
      setUserPostcode(postcodeMatch[0]);
    }
  };

  const handleSearch = (query: string) => {
    console.log("New search:", query);
    const postcodeMatch = query.match(/^[A-Z]{1,2}\d{1,2}/i);
    if (postcodeMatch) {
      setUserPostcode(postcodeMatch[0]);
    }
  };

  const handlePropertyClick = (property: any) => {
    console.log("Navigating to postcode analysis for:", property.postcode);
    // Here you can add navigation to your postcode analysis page
    // router.push(`/analysis/${property.postcode}`);
  };

  return (
    <div className="flex h-screen bg-black text-white">
      <Sidebar onSearchSelect={handleSearchSelect} />

      <div className="flex-1 flex flex-col">
        <div className="flex justify-end p-4">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="mb-16 text-white">
            <BarChart3 className="h-24 w-24 mx-auto" />
          </div>
          <div className="w-full max-w-md">
            <div className="relative">
              <TypingInput
                typingText="Enter Address"
                typingSpeed={120}
                className="bg-transparent border-zinc-700 rounded-md py-6 pl-8 pr-4 text-sm w-full focus:border-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 text-white placeholder:text-zinc-400"
                onSearch={handleSearch}
              />
              <div className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
            </div>
            <div className="flex mt-4 gap-2">
              <Button className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-md px-4 py-2 text-xs">
                <PoundSterling className="h-4 w-4 mr-2" />
                Price
              </Button>
              <Button
                variant="outline"
                className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-md px-4 py-2 text-xs bg-transparent"
              >
                <User className="h-4 w-4 mr-2" />
                Leads
              </Button>
              <div className="flex-1"></div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-md px-4 py-2 text-xs bg-transparent"
                  >
                    Distance
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32 bg-zinc-900 border-zinc-700">
                  <DropdownMenuItem className="text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer">1 mile</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer">2 miles</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer">5 miles</DropdownMenuItem>
                  <DropdownMenuItem className="text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer">10 miles</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <SoldPropertiesTicker 
          userPostcode={userPostcode}
          onPropertyClick={handlePropertyClick}
        />
      </div>
    </div>
  )
}
