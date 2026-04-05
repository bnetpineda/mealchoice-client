import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getSellerProductsBySellerId, type Seller, type Product } from '@/api/products';
import { useCart } from '@/contexts/CartContext';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Package,
  ShoppingBag,
  ShoppingCart,
  Plus,
  Minus,
  Check,
  QrCode,
  Truck,
  Loader2,
  Store
} from 'lucide-react';
import { getImageUrl } from '@/config/api';
import { formatCurrency } from '@/lib/utils';

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function isCurrentlyOpen(operatingHours?: Seller['operatingHours']) {
  if (!operatingHours) return false;
  const today = DAYS[new Date().getDay()];
  const todayHours = operatingHours[today];
  if (!todayHours || todayHours.isClosed) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = todayHours.open.split(':').map(Number);
  const [closeH, closeM] = todayHours.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

function getMarketColor(market: string | null) {
  if (market === 'San Nicolas Market') return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (market === 'Pampang Public Market') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
}

function getMarketLabel(market: string | null) {
  if (market === 'San Nicolas Market') return 'San Nicolas Market';
  if (market === 'Pampang Public Market') return 'Pampang Public Market';
  return 'Unknown';
}

export function StallProfile() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const { addItem, getItemQuantity, totalItems } = useCart();

  useEffect(() => {
    const fetchSeller = async () => {
      if (!sellerId) return;
      setLoading(true);
      try {
        const response = await getSellerProductsBySellerId(sellerId);
        if (response.success && response.seller) {
          setSeller(response.seller);
          setProducts(response.products || []);
          setCategories(response.categories || []);
        }
      } catch (error) {
        console.error('Error fetching stall:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSeller();
  }, [sellerId]);

  const getQuantity = (productId: string) => quantities[productId] || 1;

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta)
    }));
  };

  const handleAddToCart = (product: Product) => {
    const qty = getQuantity(product._id);
    addItem(product, qty);
    setQuantities(prev => ({ ...prev, [product._id]: 1 }));
  };

  if (loading) {
    return (
      <CustomerLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </CustomerLayout>
    );
  }

  if (!seller) {
    return (
      <CustomerLayout>
        <div className="text-center py-12">
          <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-foreground">Stall not found</h3>
          <Button asChild>
            <Link to="/customer/stalls">Back to Stalls</Link>
          </Button>
        </div>
      </CustomerLayout>
    );
  }

  const open = isCurrentlyOpen(seller.operatingHours);
  const displayName = seller.stallName || seller.name;
  const displayNumber = seller.stallNumber;

  return (
    <CustomerLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          {totalItems > 0 && (
            <Button asChild className="ml-auto">
              <Link to="/customer/cart">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Cart ({totalItems})
              </Link>
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1">
                <div className="flex items-start gap-3 flex-wrap">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
                    {displayNumber && (
                      <p className="text-muted-foreground">Stall {displayNumber}</p>
                    )}
                  </div>
                  <Badge variant={open ? 'default' : 'secondary'}>
                    {open ? 'Open Now' : 'Closed'}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className={getMarketColor(seller.marketLocation)}>
                    <MapPin className="h-3 w-3 mr-1" />
                    {getMarketLabel(seller.marketLocation)}
                  </Badge>
                  {seller.acceptsQR && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <QrCode className="h-3 w-3" />
                      Accepts QR
                    </Badge>
                  )}
                  {seller.hasOwnDelivery && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      Own Delivery
                    </Badge>
                  )}
                </div>

                {categories.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {categories.map((cat) => (
                      <Badge key={cat} variant="secondary" className="capitalize text-xs">
                        {cat}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {seller.operatingHours && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Operating Hours
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  {DAYS.map((day) => {
                    const hours = seller.operatingHours?.[day];
                    const isToday = day === DAYS[new Date().getDay()];
                    return (
                      <div
                        key={day}
                        className={`px-3 py-2 rounded-lg ${
                          isToday
                            ? 'bg-primary/10 border border-primary/20'
                            : 'bg-muted/50'
                        }`}
                      >
                        <p className={`font-medium capitalize ${isToday ? 'text-primary' : ''}`}>
                          {day}
                          {isToday && <span className="ml-1 text-xs">(Today)</span>}
                        </p>
                        {hours?.isClosed ? (
                          <p className="text-xs text-muted-foreground">Closed</p>
                        ) : hours ? (
                          <p className="text-xs text-muted-foreground">
                            {formatTime(hours.open)} - {formatTime(hours.close)}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">-</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Products ({products.length})
          </h2>

          {products.length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-foreground">No products available</h3>
              <p className="text-muted-foreground">This stall doesn't have any products listed yet</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => {
                const inCart = getItemQuantity(product._id) > 0;
                const qty = getQuantity(product._id);

                return (
                  <Card key={product._id}>
                    <div className="h-36 bg-muted flex items-center justify-center overflow-hidden">
                      {product.image ? (
                        <img
                          src={getImageUrl(product.image!)}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
                      )}
                    </div>
                    <CardContent>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold line-clamp-1">{product.name}</h3>
                        <Badge variant="secondary" className="capitalize shrink-0">
                          {product.category}
                        </Badge>
                      </div>

                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                          {product.description}
                        </p>
                      )}

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-bold text-primary">
                              {formatCurrency(product.price)}
                              <span className="text-sm font-normal text-muted-foreground">
                                /{product.unit}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center border rounded-lg">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-r-none"
                              onClick={() => updateQuantity(product._id, -1)}
                              disabled={qty <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-10 text-center font-medium text-sm">
                              {qty}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-l-none"
                              onClick={() => updateQuantity(product._id, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant={inCart ? 'secondary' : 'default'}
                            onClick={() => handleAddToCart(product)}
                            className="flex-1"
                          >
                            {inCart ? (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                Add More
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Add
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </CustomerLayout>
  );
}
