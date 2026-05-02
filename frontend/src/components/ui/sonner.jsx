import { Toaster as Sonner, toast } from "sonner"

const Toaster = ({
  ...props
}) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#12121A] group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-[#A0A0B0]",
          actionButton:
            "group-[.toast]:bg-[#FF6B00] group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-[#12121A] group-[.toast]:text-[#A0A0B0]",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
