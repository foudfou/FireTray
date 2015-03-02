#include <gdk/gdk.h>

extern int gdk_is_window(void* obj);
extern int gtk_is_window(void* obj);
extern int gtk_is_widget(void* obj);

/* the library version (not headers). These functions are provided natively in
 * gtk+-3.0 */
extern unsigned int gtk_get_major_version(void);
extern unsigned int gtk_get_minor_version(void);
extern unsigned int gtk_get_micro_version(void);
