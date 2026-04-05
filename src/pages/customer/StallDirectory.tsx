import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getVerifiedSellers, type Seller } from '@/api/products';
import { useAuth } from '@/contexts/AuthContext';
import {
  MapPin,
  Search,
  Store,
  Clock,
  Package,
  Truck,
  Loader2,
  QrCode
} from 'lucide-react';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function getTodayHours(operatingHours?: Seller['operatingHours']) {
  if (!operatingHours) return null;
  const today = DAYS[new Date().getDay()];
  return operatingHours[today] || null;
}

function isCurrentlyOpen(operatingHours?: Seller['operatingHours']) {
  const todayHours = getTodayHours(operatingHours);
  if (!todayHours || todayHours.isClosed) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = todayHours.open.split(':').map(Number);
  const [closeH, closeM] = todayHours.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}

function formatHours(hours: { open: string; close: string }) {
  return `${hours.open} - ${hours.close}`;
}

function getMarketColor(market: string | null) {
  if (market === 'San Nicolas Market') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (market === 'Pampang Public Market') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}

function getMarketLabel(market: string | null) {
  if (market === 'San Nicolas Market') return 'San Nicolas';
  if (market === 'Pampang Public Market') return 'Pampanga';
  return 'Unknown';
}

export function StallDirectory() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [stalls, setStalls] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);

  useEffect(() => {
    const fetchStalls = async () => {
      setLoading(true);
      try {
        const response = await getVerifiedSellers(token || '', selectedMarket || undefined);
        if (response.success && response.sellers) {
          setStalls(response.sellers);
        }
      } catch (error) {
        console.error('Error fetching stalls:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStalls();
  }, [token, selectedMarket]);

  const filteredStalls = stalls.filter(stall => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const stallName = (stall.stallName || stall.name).toLowerCase();
    const stallNumber = (stall.stallNumber || '').toLowerCase();
    return stallName.includes(query) || stallNumber.includes(query);
  });

  return (
    <CustomerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Browse Stalls</h1>
          <p className="text-muted-foreground">Discover stalls across local Angeles City markets</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search stalls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={selectedMarket === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMarket(null)}
              className="text-foreground"
            >
              All Markets
            </Button>
            <Button
              variant={selectedMarket === 'San Nicolas Market' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMarket('San Nicolas Market')}
              className="text-foreground"
            >
              <MapPin className="h-4 w-4 mr-1" />
              San Nicolas
            </Button>
            <Button
              variant={selectedMarket === 'Pampang Public Market' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedMarket('Pampang Public Market')}
              className="text-foreground"
            >
              <MapPin className="h-4 w-4 mr-1" />
              Pampanga
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredStalls.length === 0 ? (
          <div className="text-center py-12 border rounded-lg border-dashed">
            <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-foreground">No stalls found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try a different search term' : 'No stalls available in this market yet'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredStalls.map((stall) => {
              const open = isCurrentlyOpen(stall.operatingHours);
              const todayHours = getTodayHours(stall.operatingHours);
              const displayName = stall.stallName || stall.name;
              const displayNumber = stall.stallNumber;

              return (
                <Card
                  key={stall._id}
                  className="cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => navigate(`/customer/stalls/${stall._id}`)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                          {displayName}
                        </h3>
                        {displayNumber && (
                          <p className="text-sm text-muted-foreground">Stall {displayNumber}</p>
                        )}
                      </div>
                      <Badge variant={open ? 'default' : 'secondary'} className="shrink-0 text-xs">
                        {open ? 'Open' : 'Closed'}
                      </Badge>
                    </div>

                    <Badge variant="outline" className={getMarketColor(stall.marketLocation)}>
                      <MapPin className="h-3 w-3 mr-1" />
                      {getMarketLabel(stall.marketLocation)}
                    </Badge>

                    {todayHours && !todayHours.isClosed && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{formatHours(todayHours)}</span>
                      </div>
                    )}

                    {stall.categories && stall.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {stall.categories.slice(0, 3).map((cat) => (
                          <Badge key={cat} variant="secondary" className="text-xs capitalize">
                            {cat}
                          </Badge>
                        ))}
                        {stall.categories.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{stall.categories.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Package className="h-3 w-3" />
                        <span>{stall.productCount || 0} products</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {stall.acceptsQR && (
                          <span title="Accepts QR payments"><QrCode className="h-3.5 w-3.5 text-muted-foreground" /></span>
                        )}
                        {stall.hasOwnDelivery && (
                          <span title="Has own delivery"><Truck className="h-3.5 w-3.5 text-muted-foreground" /></span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
