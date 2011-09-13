#include <stdio.h>

#include <gtk/gtk.h>
#include "firefox.xpm"

#define MIN_FONT_SIZE 4

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

/*
- Hide/Show window to avoid minimizing it to the task bar (yes, use gtk_widget_hide() and gtk_widget_show()) when the user clicks on the system tray icon
- Listen to the "window-state-event" (GObject's signal) to detect when minimizing and, instead of doing that, hide the window (ie, "minimize to the tray").
*/

/* This callback quits the program */
gint delete_event( GtkWidget *widget,
                   GdkEvent *event,
                   gpointer
                   data )
{
  gtk_main_quit ();
  return FALSE;
}

static void winShowHide(GtkMenuItem *item, gpointer window) 
{
  /* GdkWindow * tl_window = gdk_window_get_toplevel((GdkWindow*)window); */

  /* GdkWindowState ws = gdk_window_get_state((GdkWindow*)tl_window); */
  /* printf("GdkWindowState: %d", ws); */

  /* gdk_window_hide(window->window); */
  /* gtk_widget_show(GTK_WIDGET(window)); */
  gtk_widget_hide(GTK_WIDGET(window));
}

SetIconText(GtkStatusIcon *tray_icon, const char *text, const char *color) {

  // build background from image
  GdkPixbuf* special_icon = gdk_pixbuf_new_from_file("newmail.png", NULL); // GError **error);
  GdkPixbuf *dest = gdk_pixbuf_copy(special_icon);
  int w=gdk_pixbuf_get_width(special_icon);
  int h=gdk_pixbuf_get_height(special_icon);

  // prepare colors/alpha
  GdkColormap* cmap=gdk_screen_get_system_colormap(gdk_screen_get_default());
  int screen_depth=24;
  GdkVisual* visual = gdk_colormap_get_visual(cmap);
  screen_depth = visual->depth;
  GdkColor fore = { 0, 0, 0, 0 };
  GdkColor alpha  = { 0xFFFF, 0xFFFF, 0xFFFF, 0xFFFF};
  gdk_color_parse  (color, &fore) )
  if(fore.red==alpha.red && fore.green==alpha.green && fore.blue==alpha.blue) {
    alpha.red=0; //make sure alpha is different from fore
  }
  gdk_colormap_alloc_color (cmap, &fore, TRUE, TRUE);
  gdk_colormap_alloc_color (cmap, &alpha, TRUE, TRUE);

  // build pixmap with rectangle
  GdkPixmap *pm = gdk_pixmap_new (NULL, w, h, screen_depth);
  GdkGC *gc = gdk_gc_new (pm); // graphic context. DEPRECATED ?
  gdk_gc_set_foreground(gc,&alpha);
  /* gdk_draw_rectangle(pm,gc,TRUE, 0, 0, w ,h ); */
  cairo_t *cr;
  cr = gdk_cairo_create(pm);
  cairo_rectangle(cr, 0, 0, w, h);
  /* void                cairo_rectangle                     (cairo_t *cr, */
  /*                                                          double x, */
  /*                                                          double y, */
  /*                                                          double width, */
  /*                                                          double height); */
  cairo_set_source_rgb(cr, 1, 1, 1); /* TODO: consider cairo_set_source_rgba (notice the ending "a" for alpha) */
  cairo_fill(cr);
  cairo_destroy(cr);

  // build text
  GtkWidget *scratch = gtk_window_new(GTK_WINDOW_TOPLEVEL);
  PangoLayout *layout = gtk_widget_create_pango_layout(scratch, NULL);
  gtk_widget_destroy(scratch);
  PangoFontDescription *fnt = pango_font_description_from_string("Sans 18");
  pango_font_description_set_weight (fnt,PANGO_WEIGHT_SEMIBOLD);
  pango_layout_set_spacing            (layout,0);
  pango_layout_set_font_description   (layout, fnt);
  pango_layout_set_text (layout, (gchar *)text,-1);
  int tw=0;
  int th=0;
  int sz;
  int border=4;
  pango_layout_get_pixel_size(layout, &tw, &th);
  while( (tw>w - border || th > h - border)) //fit text to the icon by decreasing font size
  {
    sz=pango_font_description_get_size (fnt);
    if(sz<MIN_FONT_SIZE) {
      sz=MIN_FONT_SIZE;
      break;
    }
    sz-=PANGO_SCALE;
    pango_font_description_set_size (fnt,sz);
    pango_layout_set_font_description   (layout, fnt);
    pango_layout_get_pixel_size(layout, &tw, &th);
  }
  // center text
  int px, py;
  px=(w-tw)/2;
  py=(h-th)/2;

  // draw text on pixmap
  gdk_draw_layout_with_colors (pm, gc, px, py, layout, &fore,NULL);

  GdkPixbuf *buf = gdk_pixbuf_get_from_drawable (NULL, pm, NULL, 0, 0, 0, 0, w, h);
  g_object_unref (pm);
  GdkPixbuf *alpha_buf = gdk_pixbuf_add_alpha  (buf, TRUE, (guchar)alpha.red, (guchar)alpha.green, (guchar)alpha.blue);

  // cleaning
  g_object_unref (buf);
  g_object_unref (layout);
  pango_font_description_free (fnt);
  g_object_unref (gc);


  //merge the rendered text on top
  gdk_pixbuf_composite (alpha_buf,dest,0,0,w,h,0,0,1,1,GDK_INTERP_NEAREST,255);
  g_object_unref(alpha_buf);


  gtk_status_icon_set_from_pixbuf(GTK_STATUS_ICON(tray_icon), GDK_PIXBUF(dest));
}


int main(int argc, char **argv) {
        GtkStatusIcon *tray_icon;

        gtk_init(&argc, &argv);
        tray_icon = create_tray_icon();
    
    GtkWidget *window = gtk_window_new(GTK_WINDOW_TOPLEVEL);
    gtk_window_set_title (GTK_WINDOW (window), "GtkStatusIcon Example");
    gtk_widget_set_size_request (window, 200, -1);

    /* Set a handler for delete_event that immediately exits GTK. */
    g_signal_connect (G_OBJECT (window), "delete_event",
                      G_CALLBACK (delete_event), NULL);

    g_signal_connect(G_OBJECT(tray_icon), "activate", G_CALLBACK(winShowHide), window);

    gtk_widget_show_all (window);

    /* TESTING */
    SetIconText(tray_icon,"F", "#000000");

        gtk_main();

        return 0;
}
