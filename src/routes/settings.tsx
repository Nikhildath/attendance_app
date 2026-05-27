import { createFileRoute } from "@tanstack/react-router";
import { User, Bell, Shield, Smartphone, Globe, Moon, Sun, Monitor, LogOut, ChevronRight, Camera, Key, Fingerprint, MapPin, Database, Zap, Sparkles, ShieldCheck, Building2, Lock, Eye, EyeOff, AlertTriangle, Download, Upload, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { useSettings } from "@/lib/settings-context";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { exportToCSV, parseCSV } from "@/lib/csv-utils";
import { requestNotificationPermission, subscribeToPush } from "@/lib/push";
import { NativeBiometric } from "@capgo/capacitor-native-biometric";
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { Capacitor } from "@capacitor/core";
import { requestBatteryOptimizationExemption } from "@/lib/background-tracker";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Attendly Pro" },
      { name: "description", content: "Configure your personal profile and application preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const { settings, refresh: refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(profile?.name || "");
  const [orgData, setOrgData] = useState<any>(null);
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    if (settings) setOrgData({ ...settings });
  }, [settings]);

  const [biometryType, setBiometryType] = useState<string>("none");
  const [preferredBiometricMode, setPreferredBiometricMode] = useState<string>(() => {
    return localStorage.getItem("preferred_biometric_mode") || "system";
  });

  useEffect(() => {
    const checkBiometrics = async () => {
      try {
        const avail = await NativeBiometric.isAvailable();
        if (avail.isAvailable) {
          let typeStr = "unknown";
          const bt = avail.biometryType;
          if (bt === 1 || bt === 'touch-id' || bt === 'TouchID') typeStr = "fingerprint";
          else if (bt === 2 || bt === 'face-id' || bt === 'FaceID') typeStr = "face";
          else if (bt === 3 || bt === 'fingerprint' || bt === 'Fingerprint') typeStr = "fingerprint";
          else if (bt === 4 || bt === 'face' || bt === 'FaceAuthentication') typeStr = "face";
          else if (bt === 6 || bt === 'multiple' || bt === 'Multiple') typeStr = "multiple";
          setBiometryType(typeStr);
        }
      } catch (e) {
        console.warn("Biometrics check failed:", e);
      }
    };
    checkBiometrics();
  }, []);

  const isAdmin = profile?.role?.toLowerCase() === "admin";
  
  const handleUpdateProfile = async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { error } = await supabase.from("profiles").update({ name }).eq("id", profile.id);
    if (!error) {
      toast.success("Profile updated successfully");
      refreshProfile();
    } else {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const handleUpdateOrg = async () => {
    setLoading(true);
    const { error } = await supabase.from("organisation_settings").update(orgData).eq("id", 1);
    if (!error) {
      toast.success("Organization settings updated");
      refreshSettings();
    } else {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const handleRegisterPasskey = async () => {
    if (!profile?.id) return;
    setLoading(true);
    
    try {
      let available;
      try {
        available = await NativeBiometric.isAvailable();
      } catch {
        toast.error("Device does not support biometrics.");
        setLoading(false);
        return;
      }

      if (!available.isAvailable) {
        toast.error("Device does not support biometrics.");
        setLoading(false);
        return;
      }

      await NativeBiometric.setCredentials({
        username: profile.email || profile.id,
        password: profile.id,
        server: "attendly-pro"
      });

      const idBase64 = btoa(profile.id);

      const { error } = await supabase.from("profiles").update({ 
        passkey_credential_id: idBase64, 
        passkey_registered: true 
      }).eq("id", profile.id);
      
      if (!error) {
        toast.success("Passkey (Biometric) Identity Registered");
        refreshProfile();
      } else {
        toast.error(error.message);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Passkey registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCropSave = async () => {
    if (!cropImage || !croppedAreaPixels) return;
    setLoading(true);
    try {
      const img = new Image();
      img.src = cropImage;
      await new Promise(res => img.onload = res);
      
      const canvas = document.createElement('canvas');
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("No context");

      ctx.drawImage(
        img,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0, 0, size, size
      );

      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const { error } = await supabase.from('profiles').update({ avatar_url: dataUrl }).eq('id', profile?.id);
      if (error) throw error;
      
      toast.success("Profile picture updated");
      refreshProfile();
      setCropImage(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "security", label: "Security", icon: Shield },
    { id: "app", label: "Application", icon: Smartphone },
    ...(isAdmin ? [{ id: "organization", label: "Organization", icon: Building2 }] : []),
    { id: "data", label: "Data & Privacy", icon: Database },
  ];

  return (
    <div className="flex flex-col gap-10">
      <PageHeader 
        title="Settings" 
        subtitle="Manage your identity, security protocols and system preferences" 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "group flex items-center justify-between p-5 rounded-3xl border transition-all duration-500",
                activeTab === tab.id
                  ? "bg-primary/10 border-primary/20 text-primary shadow-glow"
                  : "bg-muted/20 dark:bg-white/[0.02] border-border/60 dark:border-white/5 text-muted-foreground dark:text-white/40 hover:bg-muted/30 dark:hover:bg-white/[0.05] hover:text-foreground dark:hover:text-white"
              )}
            >
              <div className="flex items-center gap-4">
                <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-primary" : "text-muted-foreground dark:text-zinc-500")} />
                <span className="text-xs font-black uppercase tracking-[0.2em]">{tab.label}</span>
              </div>
              <ChevronRight className={cn("w-4 h-4 transition-transform", activeTab === tab.id ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0")} />
            </button>
          ))}
          
          <button
            onClick={signOut}
            className="flex items-center gap-4 p-5 rounded-3xl bg-secondary/5 border border-secondary/10 text-secondary hover:bg-secondary/10 transition-all mt-10 active:scale-95"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-[0.2em]">Log Out System</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-10 rounded-[3rem] bg-muted/10 dark:bg-white/[0.01] backdrop-blur-3xl border border-border/30 dark:border-white/[0.03] shadow-2xl flex flex-col gap-10"
          >
            {activeTab === "profile" && (
              <div className="space-y-10">
                <div className="flex flex-col md:flex-row gap-10 items-center">
                  <div className="relative group">
                    <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div 
                      className="relative w-32 h-32 rounded-full border-4 border-border/60 dark:border-white/5 overflow-hidden shadow-2xl cursor-pointer"
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                    >
                      <img 
                        src={profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile?.email}`} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <input 
                      type="file" 
                      id="avatar-upload" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => setCropImage(event.target?.result as string);
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter">{profile?.name}</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 dark:text-white/20">{profile?.role} · {profile?.dept || "Global Workforce"}</p>
                    <div className="flex gap-2 mt-4">
                       <span className="px-3 py-1 bg-success/10 text-success border border-success/20 rounded-full text-[8px] font-black uppercase tracking-widest">Active Status</span>
                       <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[8px] font-black uppercase tracking-widest">Enterprise Verified</span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-8">
                   <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 dark:text-white/30 ml-1">Full Name</Label>
                     <Input 
                       value={name} 
                       onChange={(e) => setName(e.target.value)}
                       className="h-14 rounded-2xl bg-muted/20 dark:bg-white/[0.02] border-border/60 dark:border-white/5 focus:border-primary/50 text-sm font-bold uppercase tracking-tight" 
                     />
                   </div>
                   <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 dark:text-white/30 ml-1">Email Protocol</Label>
                     <Input 
                       value={profile?.email} 
                       disabled
                       className="h-14 rounded-2xl bg-muted/10 dark:bg-white/[0.01] border-border/60 dark:border-white/5 text-muted-foreground dark:text-white/40 text-sm font-bold uppercase tracking-tight" 
                     />
                   </div>
                </div>

                <Button 
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="h-14 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-[0.3em] italic px-10 shadow-glow hover:brightness-110 active:scale-95 transition-all"
                >
                  {loading ? "Syncing..." : "Update Identity"}
                </Button>
              </div>
            )}

            {activeTab === "security" && (
              <div className="space-y-10">
                <div className="flex items-center gap-6">
                   <div className="h-14 w-14 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/20 shadow-glow">
                      <ShieldCheck className="w-7 h-7 text-secondary" />
                   </div>
                   <div>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter">Security Protocols</h3>
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 dark:text-white/20">Manage your access and authentication methods</p>
                   </div>
                </div>

                <div className="grid gap-6">
                   <SecurityItem 
                     icon={Key} 
                     title="Access Password" 
                     desc="Secure your entry with a multi-factor password" 
                     action="Modify" 
                     onClick={() => toast.info("Password modification dialog will be available in the next security update.")}
                   />
                                     {/* Passkey Registration Section */}
                    <div className="p-6 rounded-3xl bg-muted/20 dark:bg-white/[0.02] border border-border/30 dark:border-white/[0.03] flex flex-col gap-6 group hover:bg-muted/30 dark:hover:bg-white/[0.04] transition-all">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-5">
                             <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
                                <Fingerprint className="w-5 h-5" />
                             </div>
                             <div>
                                <h4 className="text-sm font-bold uppercase tracking-tight text-foreground/80 dark:text-white/80">Biometric Passkey</h4>
                                <p className="text-[10px] font-medium text-muted-foreground/60 dark:text-white/20 uppercase tracking-widest mt-1">
                                   {profile?.passkey_registered 
                                     ? `Device Identity Active (${biometryType === 'face' ? 'Face Auth' : biometryType === 'fingerprint' ? 'Fingerprint' : 'Active'})` 
                                     : "Use TouchID / FaceID for attendance"}
                                </p>
                             </div>
                          </div>
                          <button 
                            onClick={handleRegisterPasskey}
                            disabled={loading}
                            className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                          >
                             {loading ? "Synchronizing..." : (profile?.passkey_registered ? "Re-Register" : "Activate")}
                          </button>
                       </div>

                       {profile?.passkey_registered && (
                         <div className="pt-4 border-t border-border/35 dark:border-white/5 space-y-4">
                           <Label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground dark:text-white/40 block">Preferred Verification Mode</Label>
                           <div className="grid grid-cols-3 gap-3">
                             <button
                               onClick={() => {
                                 setPreferredBiometricMode("fingerprint");
                                 localStorage.setItem("preferred_biometric_mode", "fingerprint");
                                 toast.success("Punch Verification set to Fingerprint Preferred");
                               }}
                               className={cn(
                                 "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border text-[9px] font-black uppercase tracking-wider transition-all duration-300",
                                 preferredBiometricMode === "fingerprint"
                                   ? "bg-primary/10 border-primary/30 text-primary shadow-glow animate-pulse"
                                   : "bg-muted/10 dark:bg-white/[0.01] border-border/60 dark:border-white/5 text-muted-foreground hover:bg-muted/20"
                               )}
                             >
                               <Fingerprint className="w-4 h-4" />
                               <span>Fingerprint</span>
                             </button>

                             <button
                               onClick={() => {
                                 setPreferredBiometricMode("face");
                                 localStorage.setItem("preferred_biometric_mode", "face");
                                 toast.success("Punch Verification set to Face Recognition Preferred");
                               }}
                               className={cn(
                                 "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border text-[9px] font-black uppercase tracking-wider transition-all duration-300",
                                 preferredBiometricMode === "face"
                                   ? "bg-primary/10 border-primary/30 text-primary shadow-glow animate-pulse"
                                   : "bg-muted/10 dark:bg-white/[0.01] border-border/60 dark:border-white/5 text-muted-foreground hover:bg-muted/20"
                               )}
                             >
                               <Camera className="w-4 h-4" />
                               <span>Face ID / Auth</span>
                             </button>

                             <button
                               onClick={() => {
                                 setPreferredBiometricMode("system");
                                 localStorage.setItem("preferred_biometric_mode", "system");
                                 toast.success("Punch Verification set to System Auto Select");
                               }}
                               className={cn(
                                 "flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border text-[9px] font-black uppercase tracking-wider transition-all duration-300",
                                 preferredBiometricMode === "system"
                                   ? "bg-primary/10 border-primary/30 text-primary shadow-glow animate-pulse"
                                   : "bg-muted/10 dark:bg-white/[0.01] border-border/60 dark:border-white/5 text-muted-foreground hover:bg-muted/20"
                               )}
                             >
                               <Sparkles className="w-4 h-4" />
                               <span>System Choice</span>
                             </button>
                           </div>
                         </div>
                       )}
                    </div>

                   <SecurityItem 
                     icon={Smartphone} 
                     title="Device Trusted" 
                     desc="Manage devices authorized to access your hub" 
                     action="Manage" 
                     onClick={() => toast.success("Current device marked as Trusted.")}
                   />
                </div>
              </div>
            )}

            {activeTab === "app" && (
              <div className="space-y-10">
                <div className="flex items-center gap-6">
                   <div className="h-14 w-14 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 shadow-glow">
                      <Sparkles className="w-7 h-7 text-accent" />
                   </div>
                   <div>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter">Visual Experience</h3>
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 dark:text-white/20">Configure the interface aesthetic and behavior</p>
                   </div>
                </div>

                <div className="grid gap-8">
                   <div className="space-y-6">
                      <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 dark:text-white/30 ml-1">Theme Mode</Label>
                      <div className="grid grid-cols-3 gap-4">
                         <ThemeButton active={theme === 'dark'} onClick={() => setTheme('dark')} icon={Moon} label="Dark" />
                         <ThemeButton active={theme === 'light'} onClick={() => setTheme('light')} icon={Sun} label="Light" />
                         <ThemeButton active={theme === 'system'} onClick={() => setTheme('system')} icon={Monitor} label="Auto" />
                      </div>
                   </div>

                   <div className="space-y-4 pt-4 border-t border-border/60 dark:border-white/5">
                      <SecurityItem 
                        icon={Bell} 
                        title="Neural Notifications" 
                        desc="Receive real-time tactical updates and alerts" 
                        action="Enabled" 
                        onClick={() => toast.success("Notification preferences synchronized.")}
                      />
                      <SecurityItem 
                        icon={Globe} 
                        title="Language Engine" 
                        desc="Set your preferred regional communication dialect" 
                        action="English (IN)" 
                        onClick={() => toast.info("Language settings will open soon.")}
                      />
                   </div>
                </div>
              </div>
            )}

            {activeTab === "organization" && orgData && (
              <div className="space-y-10">
                <div className="flex items-center gap-6">
                   <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-glow">
                      <Building2 className="w-7 h-7 text-primary" />
                   </div>
                   <div>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter">Organization Hub</h3>
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 dark:text-white/20">Manage global enterprise policies and fiscal rules</p>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 dark:text-white/30 ml-1">Company Name</Label>
                     <Input 
                       value={orgData.company_name} 
                       onChange={(e) => setOrgData({ ...orgData, company_name: e.target.value })}
                       className="h-14 rounded-2xl bg-muted/20 dark:bg-white/[0.02] border-border/60 dark:border-white/5 text-sm font-bold" 
                     />
                   </div>
                   <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 dark:text-white/30 ml-1">Currency Symbol</Label>
                     <Input 
                       value={orgData.default_currency} 
                       onChange={(e) => setOrgData({ ...orgData, default_currency: e.target.value })}
                       className="h-14 rounded-2xl bg-muted/20 dark:bg-white/[0.02] border-border/60 dark:border-white/5 text-sm font-bold" 
                     />
                   </div>
                   <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 dark:text-white/30 ml-1">Late Threshold (Mins)</Label>
                     <Input 
                       type="number"
                       value={orgData.late_threshold_mins} 
                       onChange={(e) => setOrgData({ ...orgData, late_threshold_mins: parseInt(e.target.value) })}
                       className="h-14 rounded-2xl bg-muted/20 dark:bg-white/[0.02] border-border/60 dark:border-white/5 text-sm font-bold" 
                     />
                   </div>
                   <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 dark:text-white/30 ml-1">Late Fine Amount</Label>
                     <Input 
                       type="number"
                       value={orgData.late_fine_amount} 
                       onChange={(e) => setOrgData({ ...orgData, late_fine_amount: parseInt(e.target.value) })}
                       className="h-14 rounded-2xl bg-muted/20 dark:bg-white/[0.02] border-border/60 dark:border-white/5 text-sm font-bold" 
                     />
                   </div>
                   <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 dark:text-white/30 ml-1">Working Hours / Day</Label>
                     <Input 
                       type="number"
                       value={orgData.working_hours_per_day} 
                       onChange={(e) => setOrgData({ ...orgData, working_hours_per_day: parseInt(e.target.value) })}
                       className="h-14 rounded-2xl bg-muted/20 dark:bg-white/[0.02] border-border/60 dark:border-white/5 text-sm font-bold" 
                     />
                   </div>
                   <div className="space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 dark:text-white/30 ml-1">Overtime Rate (Per Hr)</Label>
                     <Input 
                       type="number"
                       value={orgData.overtime_rate} 
                       onChange={(e) => setOrgData({ ...orgData, overtime_rate: parseInt(e.target.value) })}
                       className="h-14 rounded-2xl bg-muted/20 dark:bg-white/[0.02] border-border/60 dark:border-white/5 text-sm font-bold" 
                     />
                   </div>
                   <div className="col-span-full space-y-3">
                     <Label className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/70 dark:text-white/30 ml-1">Weekend Configuration</Label>
                     <select 
                       value={orgData.weekend_type || 'second_saturday_sundays'} 
                       onChange={(e) => setOrgData({ ...orgData, weekend_type: e.target.value })}
                       className="h-14 w-full rounded-2xl bg-muted/20 dark:bg-white/[0.02] border border-border/60 dark:border-white/5 text-foreground dark:text-white"
                     >
                       <option value="second_saturday_sundays">Sundays & 2nd Saturday</option>
                       <option value="all_saturdays_sundays">Sundays & All Saturdays</option>
                       <option value="only_sundays">Sundays Only</option>
                     </select>
                   </div>
                </div>

                <Button 
                  onClick={handleUpdateOrg}
                  disabled={loading}
                  className="h-14 rounded-2xl bg-primary text-primary-foreground font-black uppercase tracking-[0.3em] italic px-10 shadow-glow"
                >
                  {loading ? "Synchronizing..." : "Save Policy Updates"}
                </Button>
              </div>
            )}

            {activeTab === "data" && (
              <div className="space-y-10">
                <div className="flex items-center gap-6">
                   <div className="h-14 w-14 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/20 shadow-glow">
                      <Database className="w-7 h-7 text-secondary" />
                   </div>
                   <div>
                      <h3 className="text-xl font-black italic uppercase tracking-tighter">Data & System</h3>
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 dark:text-white/20">Backup, restore, notifications and maintenance</p>
                   </div>
                </div>

                {/* Notification Controls */}
                <div className="grid gap-4">
                   <ToggleRow label="Email Notifications" defaultChecked storageKey="pref_email_notif" />
                   <div className="p-6 rounded-3xl bg-muted/20 dark:bg-white/[0.02] border border-border/30 dark:border-white/[0.03] flex items-center justify-between">
                      <div className="flex items-center gap-5">
                         <div className="p-3 rounded-xl bg-muted/30 dark:bg-white/5 text-muted-foreground dark:text-white/40"><Bell className="w-5 h-5" /></div>
                         <div>
                            <h4 className="text-sm font-bold uppercase tracking-tight text-foreground/80 dark:text-white/80">Push Notifications</h4>
                            <p className="text-[10px] font-medium text-muted-foreground/60 dark:text-white/20 uppercase tracking-widest mt-1">Receive alerts even when browser is closed</p>
                         </div>
                      </div>
                      <button 
                        onClick={async () => {
                          const permission = await requestNotificationPermission();
                          if (!permission.granted) {
                            toast.error(permission.reason === "unsupported" ? "Push notifications are not supported on this browser." : "Notifications are blocked by the browser.");
                            return;
                          }

                          const result = await subscribeToPush(profile?.id || "");
                          if (result.ok) {
                            toast.success("Push notifications enabled on this device.");
                            return;
                          }

                          if (result.reason === "missing-vapid-key") {
                            toast.error("Push notifications are not configured yet. Add the VAPID key to enable them.");
                          } else if (result.reason === "unsupported") {
                            toast.error("Push notifications are not supported on this browser.");
                          } else {
                            toast.error("Notification permission was granted, but device registration failed.");
                          }
                        }}
                        className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                      >
                        Enable
                      </button>
                   </div>
                    {Capacitor.isNativePlatform() && (
                      <div className="p-6 rounded-3xl bg-muted/20 dark:bg-white/[0.02] border border-border/30 dark:border-white/[0.03] flex items-center justify-between">
                        <div className="flex items-center gap-5">
                          <div className="p-3 rounded-xl bg-muted/30 dark:bg-white/5 text-muted-foreground dark:text-white/40"><Zap className="w-5 h-5" /></div>
                          <div>
                            <h4 className="text-sm font-bold uppercase tracking-tight text-foreground/80 dark:text-white/80">Battery Optimization</h4>
                            <p className="text-[10px] font-medium text-muted-foreground/60 dark:text-white/20 uppercase tracking-widest mt-1">Allow reliable background location tracking</p>
                          </div>
                        </div>
                        <button
                          onClick={() => requestBatteryOptimizationExemption()}
                          className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                        >
                          Whitelist
                        </button>
                      </div>
                    )}
                    <ToggleRow label="Weekly Attendance Summary" storageKey="pref_weekly_summary" />
                    <ToggleRow label="Leave Approval Alerts" defaultChecked storageKey="pref_leave_alerts" />
                </div>

                {/* Hard Reset */}
                <div className="p-8 rounded-3xl border border-secondary/20 bg-secondary/5">
                   <div className="flex items-center gap-5">
                      <div className="p-3 rounded-xl bg-secondary/10 text-secondary"><AlertTriangle className="w-6 h-6" /></div>
                      <div>
                         <h4 className="text-sm font-black uppercase tracking-wider text-secondary">Maintenance & Hard Reset</h4>
                         <p className="text-[10px] font-medium text-muted-foreground/70 dark:text-white/30 mt-1">Clear local data, unregister service workers, and force re-login.</p>
                      </div>
                   </div>
                   <div className="mt-6 flex flex-wrap gap-4">
                      <button 
                        onClick={() => {
                          if (confirm('This will clear ALL local data and log you out. Continue?')) {
                            localStorage.clear();
                            sessionStorage.clear();
                            if ('serviceWorker' in navigator) {
                              navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
                            }
                            supabase.auth.signOut().then(() => { window.location.href = '/login?reset=true'; });
                          }
                        }}
                        className="px-6 py-3 rounded-2xl bg-secondary text-secondary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-glow hover:brightness-110 active:scale-95 transition-all"
                      >
                        Perform Hard Reset
                      </button>
                      <button 
                        onClick={() => window.location.reload()}
                        className="px-6 py-3 rounded-2xl border border-border/60 dark:border-white/5 bg-muted/30 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-white/40 hover:bg-muted/40 dark:bg-white/10 transition-all"
                      >
                        Refresh Application
                      </button>
                   </div>
                </div>

                {/* Admin Backup/Restore */}
                {isAdmin && (
                  <div className="grid gap-6">
                    <div className="p-8 rounded-3xl border border-primary/20 bg-primary/5">
                       <h4 className="text-sm font-black uppercase tracking-wider text-primary">Full System Backup & Restore</h4>
                       <p className="text-[10px] font-medium text-muted-foreground/70 dark:text-white/30 mt-1">Download or restore ALL data (Attendance, Leaves, Settings, Profiles, etc.) in a single JSON file.</p>
                       <div className="mt-6 flex flex-wrap gap-4">
                          <button 
                            onClick={async () => {
                              toast.info('Starting full system backup...');
                              try {
                                const tables = ['branches','profiles','organisation_settings','shifts','shift_schedule','attendance','leave_categories','leaves','company_holidays','payslips','comp_off_requests','financial_requests','staff_tracking'];
                                const backup: Record<string, any[]> = {};
                                for (const t of tables) { const { data } = await supabase.from(t).select('*'); backup[t] = data || []; }
                                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href = url; a.download = `attendly_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
                                toast.success('Full backup downloaded!');
                              } catch (err: any) { toast.error('Backup failed: ' + err.message); }
                            }}
                            className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] shadow-glow hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
                          >
                            <Download className="w-4 h-4" /> Download Backup
                          </button>
                          <label className="px-6 py-3 rounded-2xl border border-border/60 dark:border-white/10 bg-muted/30 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/60 dark:text-white/60 hover:bg-muted/40 dark:bg-white/10 transition-all cursor-pointer flex items-center gap-2">
                            <Upload className="w-4 h-4" /> Restore System
                            <input type="file" accept=".json" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0]; if (!file) return;
                              const reader = new FileReader();
                              reader.onload = async (ev) => {
                                try {
                                  const backup = JSON.parse(ev.target?.result as string);
                                  toast.info('Restoring all tables...');
                                  const order = ['branches','organisation_settings','shifts','shift_schedule','attendance','leave_categories','leaves','company_holidays','payslips','comp_off_requests','financial_requests','staff_tracking'];
                                  for (const t of order) { if (backup[t]?.length > 0) { await supabase.from(t).upsert(backup[t]); } }
                                  toast.success('System restore complete!'); setTimeout(() => window.location.reload(), 2000);
                                } catch { toast.error('Invalid backup file.'); }
                              };
                              reader.readAsText(file);
                            }} />
                          </label>
                       </div>
                    </div>

                    <div className="p-8 rounded-3xl border border-dashed border-border/60 dark:border-white/10 bg-muted/20 dark:bg-white/[0.02]">
                       <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground dark:text-white/40">Workforce CSV Tools</h4>
                       <p className="text-[10px] font-medium text-muted-foreground/60 dark:text-white/20 mt-1">Export or import the employee list for spreadsheet use.</p>
                       <div className="mt-4 flex flex-wrap gap-6">
                          <button 
                            onClick={async () => {
                              const { data } = await supabase.from('profiles').select('*');
                              if (data) { exportToCSV(data, 'attendly_workforce'); toast.success('Workforce CSV downloaded!'); }
                            }}
                            className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline underline-offset-4"
                          >
                            Export Workforce CSV
                          </button>
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline underline-offset-4 cursor-pointer">
                            Restore from CSV
                            <input type="file" accept=".csv" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0]; if (!file) return;
                              const reader = new FileReader();
                              reader.onload = async (ev) => {
                                try {
                                  const data = parseCSV(ev.target?.result as string);
                                  if (data.length === 0) throw new Error('No data');
                                  toast.info(`Restoring ${data.length} records...`);
                                  await supabase.from('profiles').upsert(data);
                                  toast.success('Workforce restored!'); setTimeout(() => window.location.reload(), 2000);
                                } catch (err: any) { toast.error('Restore failed: ' + err.message); }
                              };
                              reader.readAsText(file);
                            }} />
                          </label>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Image Crop Modal */}
      <AnimatePresence>
        {cropImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          >
            <div className="bg-[#0a0a0a] rounded-3xl border border-border/60 dark:border-white/10 p-6 w-full max-w-md flex flex-col gap-6 shadow-2xl relative overflow-hidden">
               <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
               <h3 className="text-lg font-black uppercase tracking-widest text-center text-white relative z-10">Adjust Image</h3>
               <div className="relative w-full h-80 bg-black/50 rounded-2xl overflow-hidden border border-border/60 dark:border-white/5">
                 <Cropper
                   image={cropImage}
                   crop={crop}
                   zoom={zoom}
                   aspect={1}
                   cropShape="round"
                   showGrid={false}
                   onCropChange={setCrop}
                   onCropComplete={(croppedArea, croppedAreaPixels) => setCroppedAreaPixels(croppedAreaPixels)}
                   onZoomChange={setZoom}
                 />
               </div>
               
               <div className="relative z-10 space-y-4">
                 <div className="px-4">
                   <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground dark:text-white/40 block mb-2 text-center">Zoom Level</Label>
                   <input
                     type="range"
                     value={zoom}
                     min={1}
                     max={3}
                     step={0.1}
                     aria-labelledby="Zoom"
                     onChange={(e) => setZoom(Number(e.target.value))}
                     className="w-full accent-primary"
                   />
                 </div>
                 <div className="flex gap-4">
                   <Button variant="ghost" className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest text-foreground/50 dark:text-white/50 hover:bg-muted/30 dark:bg-white/5" onClick={() => setCropImage(null)}>Cancel</Button>
                   <Button className="flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-glow hover:brightness-110" onClick={handleCropSave} disabled={loading}>
                     {loading ? "Saving..." : "Save Image"}
                   </Button>
                 </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SecurityItem({ icon: Icon, title, desc, action, disabled, onClick }: any) {
  return (
    <div className="p-6 rounded-3xl bg-muted/20 dark:bg-white/[0.02] border border-border/30 dark:border-white/[0.03] flex items-center justify-between group hover:bg-muted/30 dark:hover:bg-white/[0.04] transition-all">
       <div className="flex items-center gap-5">
          <div className="p-3 rounded-xl bg-muted/30 dark:bg-white/5 text-muted-foreground dark:text-white/40 group-hover:text-primary transition-colors">
             <Icon className="w-5 h-5" />
          </div>
          <div>
             <h4 className="text-sm font-bold uppercase tracking-tight text-foreground/80 dark:text-white/80">{title}</h4>
             <p className="text-[10px] font-medium text-muted-foreground/60 dark:text-white/20 uppercase tracking-widest mt-1">{desc}</p>
          </div>
       </div>
       <button 
         onClick={onClick}
         disabled={disabled}
         className={cn(
           "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
           disabled ? "bg-muted/30 dark:bg-white/5 text-muted-foreground/60 dark:text-white/20 cursor-not-allowed" : "bg-muted/30 dark:bg-white/5 text-foreground/60 dark:text-white/60 hover:bg-primary hover:text-primary-foreground"
         )}
       >
         {action}
       </button>
    </div>
  );
}

function ThemeButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-3 p-6 rounded-3xl border transition-all duration-500",
        active ? "bg-primary/10 border-primary/20 text-primary shadow-glow" : "bg-muted/20 dark:bg-white/[0.02] border-border/60 dark:border-white/5 text-muted-foreground dark:text-zinc-500 hover:border-border/60 dark:border-white/10"
      )}
    >
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
    </button>
  );
}

function ToggleRow({ label, defaultChecked, storageKey }: { label: string; defaultChecked?: boolean; storageKey?: string }) {
  const [on, setOn] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) return saved === 'true';
    }
    return !!defaultChecked;
  });

  const handleToggle = () => {
    const newVal = !on;
    setOn(newVal);
    if (storageKey) {
      localStorage.setItem(storageKey, newVal.toString());
      toast.success(`${label} ${newVal ? 'enabled' : 'disabled'}`);
    }
  };

  return (
    <div className="p-6 rounded-3xl bg-muted/20 dark:bg-white/[0.02] border border-border/30 dark:border-white/[0.03] flex items-center justify-between">
       <span className="text-sm font-bold uppercase tracking-tight text-foreground/80 dark:text-white/80">{label}</span>
       <button
         onClick={handleToggle}
         className={cn(
           "relative h-6 w-11 rounded-full transition-colors",
           on ? "bg-primary" : "bg-muted/40 dark:bg-white/10"
         )}
       >
         <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "left-[22px]" : "left-0.5")} />
       </button>
    </div>
  );
}
