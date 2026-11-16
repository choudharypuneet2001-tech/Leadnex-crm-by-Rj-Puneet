'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  ExternalLink,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Navigation,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useClinics } from '@/hooks/use-clinics';
import type { ManagedClinic } from '@/lib/clinics/clinics-service';
import { SettingsPanelHead } from './settings-panel-head';

export function ClinicsSettings() {
  const { clinics, loading, refreshClinics, setClinics } = useClinics();

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<ManagedClinic | null>(null);
  const [formCity, setFormCity] = useState('');
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLandmark, setFormLandmark] = useState('');
  const [formMapsUrl, setFormMapsUrl] = useState('');
  const [formHelpline, setFormHelpline] = useState('+91 93524 93700');
  const [formTimings, setFormTimings] = useState('10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)');
  const [formIsActive, setFormIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Delete Modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingClinic, setDeletingClinic] = useState<ManagedClinic | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleOpenAdd = () => {
    setEditingClinic(null);
    setFormCity('');
    setFormName('');
    setFormAddress('');
    setFormLandmark('');
    setFormMapsUrl('');
    setFormHelpline('+91 93524 93700');
    setFormTimings('10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)');
    setFormIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (clinic: ManagedClinic) => {
    setEditingClinic(clinic);
    setFormCity(clinic.city);
    setFormName(clinic.name);
    setFormAddress(clinic.address || '');
    setFormLandmark(clinic.landmark || '');
    setFormMapsUrl(clinic.google_maps_url || '');
    setFormHelpline(clinic.helpline || '+91 93524 93700');
    setFormTimings(clinic.timings || '10:00 AM से 6:30 PM (सोमवार से रविवार - सातों दिन खुला)');
    setFormIsActive(clinic.is_active !== false);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formCity.trim()) {
      toast.error('City name is required (शहर का नाम आवश्यक है)');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<ManagedClinic> = {
        id: editingClinic ? editingClinic.id : undefined,
        city: formCity.trim(),
        name: formName.trim() || `${formCity.trim()} Clinic`,
        address: formAddress.trim(),
        landmark: formLandmark.trim(),
        google_maps_url: formMapsUrl.trim() || `https://maps.google.com/?q=Gynocci+${encodeURIComponent(formCity.trim())}`,
        helpline: formHelpline.trim(),
        timings: formTimings.trim(),
        is_active: formIsActive,
      };

      const res = await fetch('/api/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinic: payload }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to save clinic');
      }

      const data = await res.json();
      if (data.clinics) {
        setClinics(data.clinics);
      } else {
        await refreshClinics();
      }

      toast.success(editingClinic ? 'Clinic details updated' : 'New clinic branch added');
      setModalOpen(false);
    } catch (err: any) {
      console.error('[ClinicsSettings] save error:', err);
      toast.error(err?.message || 'Failed to save clinic');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (clinic: ManagedClinic) => {
    try {
      const updatedStatus = !clinic.is_active;
      const res = await fetch('/api/clinics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic: {
            ...clinic,
            is_active: updatedStatus,
          },
        }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      if (data.clinics) {
        setClinics(data.clinics);
      } else {
        await refreshClinics();
      }
      toast.success(`${clinic.city} clinic is now ${updatedStatus ? 'Active' : 'Inactive'}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async () => {
    if (!deletingClinic) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clinics?id=${encodeURIComponent(deletingClinic.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete clinic');
      const data = await res.json();
      if (data.clinics) {
        setClinics(data.clinics);
      } else {
        await refreshClinics();
      }
      toast.success(`${deletingClinic.city} clinic removed successfully`);
      setDeleteOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete clinic');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="max-w-4xl animate-in fade-in-50 space-y-6 duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <SettingsPanelHead
          title="Clinics & Branches (क्लीनिक्स व शाखाएँ)"
          description="Manage physical clinic branches (addresses, Google Maps links, phone numbers, and timings). Changes made here will instantly appear across the CRM and in the Bookings consultation mode list."
        />
        <Button onClick={handleOpenAdd} className="gap-2 shrink-0 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          <span>+ Add New Clinic</span>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>Gynocci Physical Clinics ({clinics.length})</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Active clinics will appear in the Bookings dropdown for in-person consultations.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refreshClinics()}
            disabled={loading}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
            title="Refresh list"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>

        <CardContent>
          {loading && clinics.length === 0 ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : clinics.length === 0 ? (
            <div className="p-8 text-center border rounded-lg border-dashed">
              <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-foreground">No clinics configured yet</p>
              <p className="text-xs text-muted-foreground mt-1">Click &apos;+ Add New Clinic&apos; above to add your first branch.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {clinics.map((clinic) => (
                <div
                  key={clinic.id}
                  className={`p-4 rounded-xl border transition-all ${
                    clinic.is_active
                      ? 'bg-card hover:border-primary/40 hover:shadow-xs'
                      : 'bg-muted/40 opacity-75 border-dashed'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {clinic.name}
                        </span>
                        {clinic.is_active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] py-0 px-1.5 font-medium">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-medium">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs font-mono font-medium text-primary">
                        📍 {clinic.city}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleOpenEdit(clinic)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit Clinic Details"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setDeletingClinic(clinic);
                          setDeleteOpen(true);
                        }}
                        className="h-7 w-7 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                        title="Delete Clinic"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {clinic.address && (
                      <p className="line-clamp-2 leading-relaxed text-foreground/80">
                        {clinic.address}
                      </p>
                    )}
                    {clinic.landmark && (
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">Landmark:</span> {clinic.landmark}
                      </p>
                    )}
                    <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px]">
                      {clinic.helpline && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-primary" />
                          <span>{clinic.helpline}</span>
                        </div>
                      )}
                      {clinic.timings && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate max-w-[170px]">{clinic.timings}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-xs">
                    {clinic.google_maps_url ? (
                      <a
                        href={clinic.google_maps_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        <Navigation className="h-3 w-3" />
                        <span>Google Maps</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">No map link</span>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(clinic)}
                      className={`h-6 px-2 text-[11px] ${
                        clinic.is_active
                          ? 'text-amber-700 dark:text-amber-300 hover:bg-amber-500/10'
                          : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10'
                      }`}
                    >
                      {clinic.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Clinic Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <span>{editingClinic ? 'Edit Clinic Branch' : 'Add New Clinic Branch'}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure clinic address, Google Maps link, and contact details for patient appointments.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  City (शहर) *
                </label>
                <Input
                  placeholder="e.g. Jaipur, Delhi, Mumbai"
                  value={formCity}
                  onChange={(e) => setFormCity(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">
                  Branch Name (शाखा का नाम)
                </label>
                <Input
                  placeholder="e.g. Jaipur (Head Office)"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-primary" />
                <span>Full Physical Address (पूरा पता)</span>
              </label>
              <Textarea
                rows={2}
                placeholder="e.g. 45, Hanuman Vatika, Chitrakoot Marg, Tagore Nagar, Vaishali Nagar, Jaipur"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Landmark / पहचानी जगह
              </label>
              <Input
                placeholder="e.g. Near Metro Pillar No. 388 / Chitrakoot Marg"
                value={formLandmark}
                onChange={(e) => setFormLandmark(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                <Navigation className="h-3 w-3 text-primary" />
                <span>Google Maps Location URL</span>
              </label>
              <Input
                placeholder="https://maps.google.com/?q=Gynocci+..."
                value={formMapsUrl}
                onChange={(e) => setFormMapsUrl(e.target.value)}
                className="text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3 text-primary" />
                  <span>Helpline Phone</span>
                </label>
                <Input
                  placeholder="+91 93524 93700"
                  value={formHelpline}
                  onChange={(e) => setFormHelpline(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" />
                  <span>Timings (समय)</span>
                </label>
                <Input
                  placeholder="10:00 AM से 6:30 PM (All 7 Days)"
                  value={formTimings}
                  onChange={(e) => setFormTimings(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="clinic-is-active"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
              />
              <label htmlFor="clinic-is-active" className="text-xs font-medium text-foreground cursor-pointer">
                Branch is Active (उपलब्ध है और Bookings लिस्ट में दिखेगी)
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Clinic</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Clinic Branch</DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to remove{' '}
              <strong className="text-foreground">{deletingClinic?.name}</strong>?
              This branch will no longer appear in future consultation lists.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Removing...' : 'Delete Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
