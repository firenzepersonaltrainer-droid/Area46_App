import React, { useState, useEffect } from "react";
import { Bell, Check, ExternalLink, CalendarCheck, Sparkles, X, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  AppCalendarNotification,
  getStoredNotifications,
  markNotificationAsRead,
  clearNotifications,
  checkAndProcessWaitlistUnlocks,
  buildWhatsAppSlotLink,
  formatGiornoItaliano,
} from "../lib/useSimulatedCalendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./Dialog";
import { Button } from "./Button";
import { toast } from "sonner";

interface CalendarNotificationBellProps {
  userId?: string;
  userNome?: string;
  userPhone?: string;
  coachPhone?: string;
  className?: string;
}

export function CalendarNotificationBell({
  userId,
  userNome = "Atleta",
  userPhone = "",
  coachPhone = "+39 340 0000000",
  className = "",
}: CalendarNotificationBellProps) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppCalendarNotification[]>([]);

  // Caricamento iniziale e polling per verificare sblocchi in arrivo
  useEffect(() => {
    if (!userId) return;

    const loadNotifs = () => {
      // Controlla se qualche slot in lista d'attesa è pronto per essere sbloccato
      checkAndProcessWaitlistUnlocks(userId, (newNotif) => {
        toast.success(`🔔 Posto liberato! ${newNotif.messaggio}`, {
          duration: 9000,
        });
      });
      const list = getStoredNotifications(userId);
      setNotifications(list);
    };

    loadNotifs();
    const interval = setInterval(loadNotifs, 6000); // ogni 6 secondi
    return () => clearInterval(interval);
  }, [userId]);

  const unreadCount = notifications.filter((n) => !n.letto).length;

  const handleOpenNotif = (notif: AppCalendarNotification) => {
    if (userId) {
      markNotificationAsRead(userId, notif.id);
      setNotifications(getStoredNotifications(userId));
    }
    setOpen(false);
    navigate(`/prenota?date=${notif.data}&slot=${notif.orario}`);
  };

  const handleWhatsApp = (notif: AppCalendarNotification) => {
    const targetPhone = userPhone || coachPhone;
    const link = buildWhatsAppSlotLink(targetPhone, userNome, notif.data, notif.orario);
    window.open(link, "_blank");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative p-2 rounded-full transition-all cursor-pointer flex items-center justify-center ${
          unreadCount > 0
            ? "bg-[#e3ff00]/20 text-zinc-900 ring-2 ring-[#e3ff00]"
            : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
        } ${className}`}
        title={unreadCount > 0 ? `${unreadCount} nuovi avvisi turno` : "Notifiche Calendario"}
        aria-label="Avvisi Calendario"
      >
        <Bell className={`size-4 ${unreadCount > 0 ? "text-[#1c00ff]" : "text-zinc-600"}`} />

        {/* Spia luminosa / Badge contatore */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1c00ff] px-1 text-[9px] font-black text-[#e3ff00] shadow-sm animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Modale Avvisi Postazioni */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm bg-white rounded-3xl p-5 border border-zinc-200 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-black text-zinc-900 flex items-center gap-2">
                <Bell className="size-4 text-[#1c00ff]" />
                Avvisi Postazioni Lab
              </DialogTitle>
              {notifications.length > 0 && userId && (
                <button
                  type="button"
                  onClick={() => {
                    clearNotifications(userId);
                    setNotifications([]);
                  }}
                  className="text-[10px] text-zinc-400 hover:text-zinc-700 cursor-pointer"
                >
                  Svuota
                </button>
              )}
            </div>
            <DialogDescription className="text-xs text-zinc-500">
              Postazioni che si sono liberate e aggiornamenti sui tuoi turni.
            </DialogDescription>
          </DialogHeader>

          <div className="my-3 space-y-2.5 max-h-[60vh] overflow-y-auto pr-0.5">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-400 bg-zinc-50 rounded-2xl border border-zinc-100">
                Nessun nuovo avviso al momento.
                <br />
                <span className="text-[11px] text-zinc-500 mt-1 inline-block">
                  Quando uno slot monitorato si libera, riceverai qui una notifica e un WhatsApp.
                </span>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-2xl border text-xs transition-all ${
                    !notif.letto
                      ? "bg-blue-50/70 border-blue-200 shadow-2xs"
                      : "bg-zinc-50 border-zinc-200 opacity-80"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-[#1c00ff]" />
                      <span className="font-bold text-zinc-900">
                        {formatGiornoItaliano(notif.data)}
                      </span>
                    </div>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-[#1c00ff] text-white">
                      Ore {notif.orario}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-600 mb-3 leading-snug">
                    {notif.messaggio}
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleOpenNotif(notif)}
                      className="flex-1 bg-[#1c00ff] hover:bg-[#1600cc] text-white font-bold text-xs h-8 rounded-xl cursor-pointer"
                    >
                      <CalendarCheck className="size-3.5 mr-1" /> Prenota
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleWhatsApp(notif)}
                      className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold h-8 px-2.5 rounded-xl cursor-pointer"
                      title="Avvisa Coach su WhatsApp"
                    >
                      <MessageSquare className="size-3.5 mr-1 text-emerald-600" /> WhatsApp
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
