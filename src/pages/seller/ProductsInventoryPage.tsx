import { useEffect, useState, useMemo } from 'react';
import { SellerLayout } from '@/components/layout/SellerLayout';
import { PendingVerification } from '@/components/seller/PendingVerification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  getSellerProducts,
  deleteProduct,
  bulkDeleteProducts,
  bulkToggleAvailability,
  updateProduct,
  type Product,
} from '@/api/products';
import { getSettings, updateSellerSettings as updateSellerApi } from '@/api/settings';
import { ProductForm } from '@/components/seller/ProductForm';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Package,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Save,
  Tags,
} from 'lucide-react';
import { getImageUrl } from '@/config/api';

const DEFAULT_CATEGORIES = ['vegetables', 'fruits', 'meat', 'seafood', 'grains', 'dairy', 'spices', 'others'];

export function ProductsInventoryPage() {
  const { token, user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Products tab state
  const [productsSearchQuery, setProductsSearchQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Inventory tab state
  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [editedProducts, setEditedProducts] = useState<Record<string, { quantity?: number; lowStockThreshold?: number; isAvailable?: boolean }>>({});

  // Categories state (shared)
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [lastSavedCategories, setLastSavedCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [savingCategories, setSavingCategories] = useState(false);

  const isCategoriesDirty = JSON.stringify(customCategories) !== JSON.stringify(lastSavedCategories);

  const fetchProducts = async () => {
    if (!token || !user?.isVerified) {
      setLoading(false);
      return;
    }

    try {
      const response = await getSellerProducts(token);
      if (response.success && response.products) {
        setProducts(response.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    if (!token) return;
    try {
      const response = await getSettings(token);
      if (response.success && response.settings) {
        const cats = response.settings.customCategories || [];
        setCustomCategories(cats);
        setLastSavedCategories(cats);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      try {
        const [productsRes, settingsRes] = await Promise.all([
          getSellerProducts(token),
          getSettings(token)
        ]);

        if (productsRes.success && productsRes.products) {
          setProducts(productsRes.products);
        }
        if (settingsRes.success && settingsRes.settings) {
          const cats = settingsRes.settings.customCategories || [];
          setCustomCategories(cats);
          setLastSavedCategories(cats);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const filteredProducts = useMemo(() => {
    if (!productsSearchQuery.trim()) {
      return products;
    }
    return products.filter(p =>
      p.name.toLowerCase().includes(productsSearchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(productsSearchQuery.toLowerCase())
    );
  }, [productsSearchQuery, products]);

  const filteredInventoryProducts = useMemo(() => {
    if (!inventorySearchQuery.trim()) {
      return products;
    }
    return products.filter(p =>
      p.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(inventorySearchQuery.toLowerCase())
    );
  }, [inventorySearchQuery, products]);

  const allExistingCategories = useMemo(() => {
    const categories = new Set([
      ...products.map(p => p.category.toLowerCase()),
      ...customCategories.map(c => c.toLowerCase())
    ]);
    return Array.from(categories).filter(Boolean);
  }, [products, customCategories]);

  const stats = useMemo(() => ({
    total: products.length,
    inStock: products.filter(p => p.quantity > p.lowStockThreshold).length,
    lowStock: products.filter(p => p.quantity > 0 && p.quantity <= p.lowStockThreshold).length,
    outOfStock: products.filter(p => p.quantity === 0).length,
    unavailable: products.filter(p => !p.isAvailable).length
  }), [products]);

  const handleAddClick = () => {
    setEditingProduct(null);
    setFormOpen(true);
  };

  const handleEditClick = (product: Product) => {
    setEditingProduct(product);
    setFormOpen(true);
  };

  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!token || !productToDelete) return;

    setDeleting(true);
    try {
      const response = await deleteProduct(token, productToDelete._id);
      if (response.success) {
        setProducts(products.filter(p => p._id !== productToDelete._id));
        setDeleteDialogOpen(false);
        setProductToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleFormSuccess = () => {
    setFormOpen(false);
    setEditingProduct(null);
    fetchProducts();
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p._id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!token || selectedProducts.size === 0) return;

    setBulkProcessing(true);
    try {
      const response = await bulkDeleteProducts(token, Array.from(selectedProducts));
      if (response.success) {
        setSelectedProducts(new Set());
        setBulkDeleteDialogOpen(false);
        fetchProducts();
      }
    } catch (error) {
      console.error('Error bulk deleting:', error);
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkToggleAvailability = async (isAvailable: boolean) => {
    if (!token || selectedProducts.size === 0) return;

    setBulkProcessing(true);
    try {
      const response = await bulkToggleAvailability(token, Array.from(selectedProducts), isAvailable);
      if (response.success) {
        setSelectedProducts(new Set());
        fetchProducts();
      }
    } catch (error) {
      console.error('Error bulk toggling availability:', error);
    } finally {
      setBulkProcessing(false);
    }
  };

  const getStockBadge = (product: Product) => {
    if (product.quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (product.quantity <= product.lowStockThreshold) {
      return <Badge variant="outline" className="text-yellow-600 dark:text-yellow-400 border-yellow-500/20 bg-yellow-500/10">Low Stock</Badge>;
    }
    return <Badge variant="secondary">In Stock</Badge>;
  };

  const handleFieldChange = (productId: string, field: 'quantity' | 'lowStockThreshold' | 'isAvailable', value: number | boolean) => {
    setEditedProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const handleSaveProduct = async (product: Product) => {
    if (!token) return;
    const changes = editedProducts[product._id];
    if (!changes) return;

    setSaving(product._id);
    try {
      const response = await updateProduct(token, product._id, {
        quantity: changes.quantity ?? product.quantity,
        lowStockThreshold: changes.lowStockThreshold ?? product.lowStockThreshold,
        isAvailable: changes.isAvailable ?? product.isAvailable
      });

      if (response.success && response.product) {
        setProducts(prev => prev.map(p => p._id === product._id ? response.product! : p));
        setEditedProducts(prev => {
          const updated = { ...prev };
          delete updated[product._id];
          return updated;
        });
        toast.success(`Updated ${product.name}`);
      } else {
        toast.error(response.message || 'Failed to update product');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Server error. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleAddCategory = () => {
    const trimmed = newCategory.trim().toLowerCase();
    if (!trimmed) return;
    if (DEFAULT_CATEGORIES.includes(trimmed) || customCategories.includes(trimmed)) {
      return;
    }
    setCustomCategories(prev => [...prev, trimmed]);
    setNewCategory('');
  };

  const handleRemoveCategory = (category: string) => {
    setCustomCategories(prev => prev.filter(c => c !== category));
  };

  const handleSaveCategories = async () => {
    if (!token) return;
    setSavingCategories(true);
    try {
      const response = await updateSellerApi(token, { customCategories });
      if (response.success) {
        setLastSavedCategories(customCategories);
        toast.success('Product categories updated successfully');
      } else {
        toast.error(response.message || 'Failed to update categories');
      }
    } catch (error) {
      console.error('Error saving categories:', error);
      toast.error('Server error. Please try again.');
    } finally {
      setSavingCategories(false);
    }
  };

  const getStockStatus = (product: Product) => {
    if (product.quantity === 0) return { label: 'Out of Stock', variant: 'destructive' as const, icon: XCircle };
    if (product.quantity <= product.lowStockThreshold) return { label: 'Low Stock', variant: 'outline' as const, icon: AlertTriangle, className: "text-yellow-600 dark:text-yellow-400 border-yellow-500/20 bg-yellow-500/10" };
    return { label: 'In Stock', variant: 'default' as const, icon: CheckCircle };
  };

  if (!user?.isVerified) {
    return (
      <SellerLayout>
        <PendingVerification message="You cannot manage products until your account is verified by an admin." />
      </SellerLayout>
    );
  }

  if (loading) {
    return (
      <SellerLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SellerLayout>
    );
  }

  return (
    <SellerLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Products & Inventory</h1>
            <p className="text-muted-foreground">Manage your products, stock levels, and categories</p>
          </div>
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            {/* Search and Add */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={productsSearchQuery}
                  onChange={(e) => setProductsSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {productsSearchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                    onClick={() => setProductsSearchQuery('')}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <Button onClick={handleAddClick}>
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            </div>

            {/* Bulk Actions Bar */}
            {selectedProducts.size > 0 && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border">
                <Checkbox
                  checked={selectedProducts.size === filteredProducts.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm font-medium">
                  {selectedProducts.size} product{selectedProducts.size > 1 ? 's' : ''} selected
                </span>
                <div className="flex-1" />

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkToggleAvailability(true)}
                  disabled={bulkProcessing}
                  className="gap-1"
                >
                  {bulkProcessing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                  Enable
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleBulkToggleAvailability(false)}
                  disabled={bulkProcessing}
                  className="gap-1"
                >
                  {bulkProcessing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                  Disable
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  disabled={bulkProcessing}
                  className="gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedProducts(new Set())}
                >
                  Clear
                </Button>
              </div>
            )}

            {/* Products Table */}
            {products.length === 0 ? (
              <div className="text-center py-12 border rounded-lg border-dashed">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">No products yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start by adding your first product to your inventory.
                </p>
                <Button onClick={handleAddClick}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Product
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product._id} className={selectedProducts.has(product._id) ? 'bg-muted/50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={selectedProducts.has(product._id)}
                            onCheckedChange={() => toggleProductSelection(product._id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                              {product.image ? (
                                <img
                                  src={getImageUrl(product.image!)}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{product.name}</p>
                              {product.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {product.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {product.productType === 'perishable' ? (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20">
                              Perishable
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                              Non-Perishable
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₱{product.price.toFixed(2)}
                          <span className="text-muted-foreground text-sm">/{product.unit}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {product.quantity <= product.lowStockThreshold && product.quantity > 0 && (
                              <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                            )}
                            {product.quantity} {product.unit}
                          </div>
                        </TableCell>
                        <TableCell>{getStockBadge(product)}</TableCell>
                        <TableCell>
                          {product.isAvailable ? (
                            <Badge variant="outline" className="text-primary border-primary/20 bg-primary/10">
                              <Eye className="h-3 w-3 mr-1" />
                              Visible
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground border-border bg-muted">
                              <EyeOff className="h-3 w-3 mr-1" />
                              Hidden
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditClick(product)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteClick(product)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingProduct
                      ? 'Update the product details below.'
                      : 'Fill in the details to add a new product.'}
                  </DialogDescription>
                </DialogHeader>
                <ProductForm
                  product={editingProduct}
                  existingCategories={allExistingCategories}
                  onSuccess={handleFormSuccess}
                  onCancel={() => setFormOpen(false)}
                />
              </DialogContent>
            </Dialog>

            {/* Single Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Product</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{productToDelete?.name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteConfirm}
                    disabled={deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Delete Confirmation Dialog */}
            <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selectedProducts.size} Product{selectedProducts.size > 1 ? 's' : ''}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedProducts.size} selected product{selectedProducts.size > 1 ? 's' : ''}?
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={bulkProcessing}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    disabled={bulkProcessing}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {bulkProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      `Delete ${selectedProducts.size} Product${selectedProducts.size > 1 ? 's' : ''}`
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-primary" />
                    <div>
                      <p className="text-2xl font-bold">{stats.total}</p>
                      <p className="text-sm text-muted-foreground">Total Products</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-500 dark:text-green-400" />
                    <div>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.inStock}</p>
                      <p className="text-sm text-muted-foreground">In Stock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-yellow-500 dark:text-yellow-400" />
                    <div>
                      <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats.lowStock}</p>
                      <p className="text-sm text-muted-foreground">Low Stock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
                    <div>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.outOfStock}</p>
                      <p className="text-sm text-muted-foreground">Out of Stock</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.unavailable}</p>
                      <p className="text-sm text-muted-foreground">Unavailable</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Custom Categories Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="h-5 w-5" />
                  Product Categories
                </CardTitle>
                <CardDescription>Manage your custom product categories</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {DEFAULT_CATEGORIES.map(cat => (
                    <Badge key={cat} variant="secondary" className="capitalize">
                      {cat}
                    </Badge>
                  ))}
                  {customCategories.map(cat => (
                    <Badge key={cat} variant="default" className="capitalize flex items-center gap-1">
                      {cat}
                      <button onClick={() => handleRemoveCategory(cat)} className="ml-1 hover:bg-white/20 rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add new category..."
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                    className="max-w-xs"
                  />
                  <Button onClick={handleAddCategory} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                  {isCategoriesDirty && (
                    <div className="flex gap-2">
                      <Button onClick={handleSaveCategories} size="sm" disabled={savingCategories}>
                        {savingCategories ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                        Save Changes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCustomCategories(lastSavedCategories)}
                        disabled={savingCategories}
                      >
                        Discard
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Stock Editor */}
            <Card>
              <CardHeader>
                <CardTitle>Stock Levels</CardTitle>
                <CardDescription>Update quantities and low stock thresholds</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search */}
                <div className="mb-4">
                  <div className="relative max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search products..."
                      value={inventorySearchQuery}
                      onChange={(e) => setInventorySearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Products Table - Desktop */}
                <div className="hidden sm:block border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Product</th>
                          <th className="text-left p-3 font-medium">Category</th>
                          <th className="text-center p-3 font-medium">Stock</th>
                          <th className="text-center p-3 font-medium">Low Threshold</th>
                          <th className="text-center p-3 font-medium">Status</th>
                          <th className="text-center p-3 font-medium">Available</th>
                          <th className="text-center p-3 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInventoryProducts.map((product) => {
                          const status = getStockStatus(product);
                          const StatusIcon = status.icon;
                          const edited = editedProducts[product._id];
                          const hasChanges = edited && (
                            edited.quantity !== undefined ||
                            edited.lowStockThreshold !== undefined ||
                            edited.isAvailable !== undefined
                          );

                          return (
                            <tr key={product._id} className="border-t">
                              <td className="p-3">
                                <div className="font-medium">{product.name}</div>
                                <div className="text-sm text-muted-foreground">₱{product.price}/{product.unit}</div>
                              </td>
                              <td className="p-3">
                                <Badge variant="outline" className="capitalize">{product.category}</Badge>
                              </td>
                              <td className="p-3 text-center">
                                <Input
                                  type="number"
                                  min="0"
                                  value={edited?.quantity ?? product.quantity}
                                  onChange={(e) => handleFieldChange(product._id, 'quantity', parseInt(e.target.value) || 0)}
                                  className="w-20 mx-auto text-center"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Input
                                  type="number"
                                  min="0"
                                  value={edited?.lowStockThreshold ?? product.lowStockThreshold}
                                  onChange={(e) => handleFieldChange(product._id, 'lowStockThreshold', parseInt(e.target.value) || 0)}
                                  className="w-20 mx-auto text-center"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Badge variant={status.variant} className={`gap-1 ${(status as any).className || ''}`}>
                                  <StatusIcon className="h-3 w-3" />
                                  {status.label}
                                </Badge>
                              </td>
                              <td className="p-3 text-center">
                                <Switch
                                  checked={edited?.isAvailable ?? product.isAvailable}
                                  onCheckedChange={(checked) => handleFieldChange(product._id, 'isAvailable', checked)}
                                />
                              </td>
                              <td className="p-3 text-center">
                                <Button
                                  size="sm"
                                  disabled={!hasChanges || saving === product._id}
                                  onClick={() => handleSaveProduct(product)}
                                >
                                  {saving === product._id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Save className="h-4 w-4" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredInventoryProducts.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground">
                      No products found
                    </div>
                  )}
                </div>

                {/* Products Cards - Mobile */}
                <div className="sm:hidden space-y-3">
                  {filteredInventoryProducts.map((product) => {
                    const status = getStockStatus(product);
                    const StatusIcon = status.icon;
                    const edited = editedProducts[product._id];
                    const hasChanges = edited && (
                      edited.quantity !== undefined ||
                      edited.lowStockThreshold !== undefined ||
                      edited.isAvailable !== undefined
                    );

                    return (
                      <div key={product._id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">₱{product.price}/{product.unit}</div>
                          </div>
                          <Badge variant={status.variant} className={`gap-1 ${(status as any).className || ''}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </div>

                        <div>
                          <Badge variant="outline" className="capitalize">{product.category}</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Stock</label>
                            <Input
                              type="number"
                              min="0"
                              value={edited?.quantity ?? product.quantity}
                              onChange={(e) => handleFieldChange(product._id, 'quantity', parseInt(e.target.value) || 0)}
                              className="text-center"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">Low Threshold</label>
                            <Input
                              type="number"
                              min="0"
                              value={edited?.lowStockThreshold ?? product.lowStockThreshold}
                              onChange={(e) => handleFieldChange(product._id, 'lowStockThreshold', parseInt(e.target.value) || 0)}
                              className="text-center"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={edited?.isAvailable ?? product.isAvailable}
                              onCheckedChange={(checked) => handleFieldChange(product._id, 'isAvailable', checked)}
                            />
                            <span className="text-sm text-muted-foreground">Available</span>
                          </div>
                          <Button
                            size="sm"
                            disabled={!hasChanges || saving === product._id}
                            onClick={() => handleSaveProduct(product)}
                          >
                            {saving === product._id ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                              <Save className="h-4 w-4 mr-1" />
                            )}
                            Save
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {filteredInventoryProducts.length === 0 && (
                    <div className="p-8 text-center text-muted-foreground border rounded-lg">
                      No products found
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </SellerLayout>
  );
}
