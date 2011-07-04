#include <gtk/gtk.h>
#include "firefox.xpm"

void tray_icon_on_click(GtkStatusIcon *status_icon, 
                        gpointer user_data)
{
        printf("Clicked on tray icon\n");
}

void tray_icon_on_menu(GtkStatusIcon *status_icon, guint button, 
                       guint activate_time, gpointer user_data)
{
        printf("Popup menu\n");
}

static GtkStatusIcon *create_tray_icon() {
        GtkStatusIcon *tray_icon;

        tray_icon = gtk_status_icon_new();
        g_signal_connect(G_OBJECT(tray_icon), "activate", 
                         G_CALLBACK(tray_icon_on_click), NULL);
        g_signal_connect(G_OBJECT(tray_icon), 
                         "popup-menu",
                         G_CALLBACK(tray_icon_on_menu), NULL);

        /* GdkPixbuf *default_icon = gdk_pixbuf_new_from_xpm_data(firefox_xpm); */

        /* gtk_status_icon_set_from_pixbuf(GTK_STATUS_ICON(tray_icon), */
        /*                                 GDK_PIXBUF(default_icon)); */
        const gchar *default_icon_filename = "firefox32.png";
        gtk_status_icon_set_from_file(tray_icon,
                                      default_icon_filename);
        gtk_status_icon_set_tooltip(tray_icon, 
                                    "Example Tray Icon");
        gtk_status_icon_set_visible(tray_icon, TRUE);

        return tray_icon;
}

int main(int argc, char **argv) {
        GtkStatusIcon *tray_icon;

        gtk_init(&argc, &argv);
        tray_icon = create_tray_icon();
        gtk_main();

        return 0;
}
