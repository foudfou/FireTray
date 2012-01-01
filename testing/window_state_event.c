#include <gtk/gtk.h>

static void trayIconActivated(GObject *trayIcon, gpointer data);
static gboolean window_state_event (GtkWidget *widget, GdkEventWindowState *event, gpointer user_data);

int main(int argc, char *argv[])
{
    gtk_init (&argc, &argv);

    GtkWidget *window = gtk_window_new (GTK_WINDOW_TOPLEVEL);
    gtk_widget_set_size_request (window, 200, 200);

    GtkStatusIcon *trayIcon  = gtk_status_icon_new_from_icon_name(GTK_STOCK_MEDIA_STOP);
    gtk_status_icon_set_tooltip (trayIcon, "My trayicon test");
    gtk_status_icon_set_visible(trayIcon, FALSE);
    g_signal_connect(GTK_STATUS_ICON (trayIcon), "activate", GTK_SIGNAL_FUNC (trayIconActivated), window);
   

    g_signal_connect (G_OBJECT (window), "window-state-event", G_CALLBACK (window_state_event), trayIcon);

   
    gtk_widget_show(window);
    gtk_main ();
    return 0;
}

static void trayIconActivated(GObject *trayIcon, gpointer window)
{
    gtk_window_deiconify(GTK_WINDOW(window));
    gtk_widget_show(GTK_WIDGET(window));
}

static gboolean window_state_event (GtkWidget *widget, GdkEventWindowState *event, gpointer trayIcon)
{
    if(event->changed_mask == GDK_WINDOW_STATE_ICONIFIED && (event->new_window_state == GDK_WINDOW_STATE_ICONIFIED || event->new_window_state == (GDK_WINDOW_STATE_ICONIFIED | GDK_WINDOW_STATE_MAXIMIZED)))
    {
        gtk_widget_hide (GTK_WIDGET(widget));
        gtk_status_icon_set_visible(GTK_STATUS_ICON(trayIcon), TRUE);
    }
    else if(event->changed_mask == GDK_WINDOW_STATE_WITHDRAWN && (event->new_window_state == GDK_WINDOW_STATE_ICONIFIED || event->new_window_state == (GDK_WINDOW_STATE_ICONIFIED | GDK_WINDOW_STATE_MAXIMIZED)))
    {
        gtk_status_icon_set_visible(GTK_STATUS_ICON(trayIcon), FALSE);
    }
    return TRUE;
}
